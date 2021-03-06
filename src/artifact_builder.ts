import * as fs from "async-file";
import * as fse from "fs-extra";
import * as path from "path";
import * as archiver from "archiver-promise";
import * as yaml from "js-yaml";
import * as child_process from "ts-process-promises";
import {isCached, getCachePath} from "./artifact_cache";
import {getConfig} from "./config";
import {Extension, ExtensionType} from "./extension";
import {Task, TaskState} from "./task";

const config = getConfig();

export function getConfiguration(task: Task): Promise<void> {
    if (isCached(task.extensions)) {
       // Return from cache
       task.setStatus(TaskState.READY);
       return Promise.resolve();
    }

    // Not cached, needs building
    return buildConfiguration(task).catch(async (e) => 
    {
        console.log("Build failed");
        console.log(e);
        const path = config.tmppath + "/" + task.getToken();
        await fs.delete(path);
        task.setStatus(TaskState.FAILED);
    });
}

async function buildConfiguration(task: Task) {
    /* An explorviz archive contains:
        - The explorviz frontend including extensions
        - The explorviz backend
        - Explorviz backend extensions
        - A startup script
        - A readme file
    */
    const path = config.tmppath + "/" + task.getToken();
    await fs.mkdirp(path);
    await fs.mkdirp(path + "/out");
    await fs.mkdirp(path + "/out/frontend");
    await fs.mkdirp(path + "/out/docker");
    await fs.mkdirp(path + "/build");
    // Build the ember js based frontend, this is unique per configuration
    await buildFrontend(task, path, task.extensions);
    // Fetch backend including extensions
    await buildBackend(task, path, task.extensions);
    // Compress to cache
    await buildArchive(task, path, task.extensions);
    // Remove build files
    await fs.delete(path);
    task.setStatus(TaskState.READY);
}


/***
 * Resolves the commit hash for an extension + version combination
 * This is primarily useful for branches like master, as master will point
 * to different commits over time
*/
export async function resolveCommit(ext: Extension)
{
    const execResults = await child_process.exec("git ls-remote " + ext.repository + " " + ext.version);
    return execResults.stdout.split("\t")[0];
}

/***
 * Adds static files to the out directory and packs everything into an archive
 */
async function buildArchive(task: Task, path: string, extensions : Extension[]) {    
    task.setStatus(TaskState.PACKING);
    await fs.mkdirp(config.cachePath);
    const archive = archiver.default(getCachePath(extensions), {
        store: true
    });

    // Add static files (Readme, startup Script)
    const targetdir = path + "/out/";
    await buildDockerCompose(targetdir, extensions);
    await buildLaunchScript(targetdir);
    await fse.copyFile("./static/Dockerfile-frontend", targetdir + "/docker/Dockerfile-frontend");
    await fse.copyFile("./static/prod-env-updater.sh", targetdir + "/docker/prod-env-updater.sh");
    await fse.copyFile("./static/Readme.md", targetdir + "/Readme.md");
    await fse.copyFile("./static/nginx.conf", targetdir + "/nginx.conf");
    archive.directory(targetdir, false)    
    return archive.finalize();
}

/**
 * Builds an explorviz frontend with a set of installed extensions
 * @param extensions Extensions to install
 */
async function buildFrontend(task: Task, targetdir: string, extensions: Extension[]) {
    task.setStatus(TaskState.FRONTEND_PREPARE);
    const frontend = extensions.find(c => c.isBase && c.extensionType == ExtensionType.FRONTEND);
    await child_process.exec("git clone -b '" + frontend.version + "' --depth 1 " + frontend.repository, { cwd: targetdir + "/build/" });

    const repoPath = targetdir + "/build/explorviz-frontend";

    // Install frontend dependencies
    await child_process.exec("npm install", { cwd: repoPath });

    // Install extensions
    task.setStatus(TaskState.FRONTEND_EXTENSION);
    await asyncForEach(extensions, async (extension) => {
        if (extension.extensionType !== ExtensionType.FRONTEND || extension.isBase) {
            return;
        }

        await child_process.exec("ember install " + extension.repository, { cwd: repoPath });
    });

    task.setStatus(TaskState.FRONTEND);
    // Build the frontend
    await child_process.exec("ember build --environment production", { cwd: repoPath});

    // Move the frontend to the target directory
    await fs.rename(repoPath + "/dist", targetdir + "/out/frontend");

    // Cleanup
    await fs.delete(repoPath);
}

/**
 * Builds an explorviz backend with a set of installed extensions
 * @param extensions Extensions to install
 */
async function buildBackend(task: Task, targetdir: string, extensions: Extension[]) {
    task.setStatus(TaskState.BACKEND_PREPARE);
    const backend = extensions.find(c => c.isBase && c.extensionType == ExtensionType.BACKEND);
    await child_process.exec("git clone -b '" + backend.version + "' --depth 1 " + backend.repository, { cwd: targetdir + "/build/" });

    const repoPath = targetdir + "/build/explorviz-backend/";
    const outdir = targetdir + "/out";
    // Build
    task.setStatus(TaskState.BACKEND);
    await child_process.exec("./gradlew assemble", { cwd: repoPath });
    // Note: Services were renamed in 
    // https://github.com/ExplorViz/explorviz-backend/commit/f3d4ecccd41501e2034b28ba741875f68e59250c
    // Therefore we need to look at (master/1.3.0)
    // - analysis
    // - discovery
    // - landscape
    // - authentication
    // as well as (dev-1, future master)
    // - analysis-service
    // - discovery-service
    // - landscape-service
    // - user-service
    // Get all .jar files (old style/1.3.0)
    await moveJarsToOutput(outdir, repoPath + "analysis/build/libs");
    await moveJarsToOutput(outdir, repoPath + "discovery/build/libs");
    await moveJarsToOutput(outdir, repoPath + "landscape/build/libs");
    await moveJarsToOutput(outdir, repoPath + "authentication/build/libs");
    // Get all .jar files (new style)
    await moveJarsToOutput(outdir, repoPath + "analysis-service/build/libs");
    await moveJarsToOutput(outdir, repoPath + "discovery-service/build/libs");
    await moveJarsToOutput(outdir, repoPath + "landscape-service/build/libs");
    await moveJarsToOutput(outdir, repoPath + "user-service/build/libs");
    // Build extensions
    task.setStatus(TaskState.BACKEND_EXTENSION);
    await asyncForEach(extensions, async (extension) => {
        await buildBackendExtension(targetdir, extension);
    });

    // Cleanup
    await fs.delete(repoPath);
}

/**
 * Recursively moves all jar files to outdir
 * @param outdir Target directory
 * @param srcdir Directory to search in. If not existing, no files will be moved
 */
async function moveJarsToOutput(outdir: string, srcdir: string)
{
    if(!await fs.exists(srcdir))
        return;
    const files = await fs.readdir(srcdir)
    await asyncForEach(files, async element => {
        if(path.extname(element) === ".jar")
            await fs.rename(srcdir + "/" + element, outdir + "/" + path.basename(element));
    });
}

/**
 * Builds a backend extension
 * @param targetdir Base directory for the build
 * @param targetdir Extension to build
 */
async function buildBackendExtension(targetdir: string, extension: Extension) {
    if (extension.extensionType !== ExtensionType.BACKEND || extension.isBase) {
        return;
    }

    const repoPath = targetdir + "/build/explorviz-" + extension.name;
    await child_process.exec("git clone -b '" + extension.version + "' --depth 1 " + extension.repository, { cwd: targetdir + "/build/" });
    await child_process.exec("./gradlew assemble", { cwd: repoPath });
    const files = await fs.readdir(repoPath + "/build/libs")
    await asyncForEach(files, async element => {
        if(path.extname(element) === ".jar")
            await fs.rename(repoPath + "/build/libs/" + element, targetdir + "/out/" + path.basename(element));
    });

}

/**
 * Async Array.forEach
 */
async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}

/**
 * Builds a launching script for all jar files as well as for the nginx frontend
 * @param targetdir Base directory for the build
 */
async function buildLaunchScript(targetdir: string)
{
    let launch = "nginx -c nginx.conf\n";
    const dir = await fs.readdir(targetdir)
    dir.forEach(element => {
        if(path.extname(element) === ".jar")
            launch += "java -jar " + element + " & \n";
    });
    await fs.writeFile(targetdir + "/launch.sh", launch, "ascii");
}

/**
 * Adds an entry to the docker compose services object for a jar file.
 * Also generates a generic Dockerfile
 * @param targetdir Base directory for the build
 * @param extensions Extensions to build docker containers for, Frontend extensions are not considered
 */
async function buildDockerCompose(targetdir: string, extensions: Extension[])
{
    // Frontend depends_on needs to contain all other services
    let depends_on = [];
    const dir = await fs.readdir(targetdir)
    dir.forEach(element => {
        if(path.extname(element) === ".jar")
        {
            const name = element.replace("explorviz-", "").replace(".jar", "");
            depends_on.push(name);
        }
    });
    
    // default services (mongodb, frontend)
    const services = {
        "mongo": 
        {
            "image": "mongo",
            "container_name": "explorviz-backend-auth-mongo",
            "volumes": [
                "explorviz-auth-mongo-data:/data/db",
                "explorviz-auth-mongo-configdb:/data/configdb"]
        },
        "frontend":
        {        
            "build": 
            {
                "dockerfile": "docker/Dockerfile-frontend",
                "context": "."
            },
            "ports":
            [
                "8090:81"
            ],
            "container_name": "explorviz-frontend",
            "depends_on": depends_on,
            "environment": [ "API_ROOT=http://localhost:8090" ]
        }
    };

    // Add services for all jars
    dir.forEach(element => {
        if(path.extname(element) === ".jar")
            addDockerComposeEntry(targetdir, element, services);
    });

    const compose = {
        "version": "3.2",
        "services": services,
        "volumes": 
        {
            "explorviz-auth-mongo-data": null,
            "explorviz-auth-mongo-configdb": null
        }
    };
    
    await fs.writeFile(targetdir + "/docker-compose.yml", yaml.dump(compose), "ascii");
}

/**
 * Adds an entry to the docker compose services object for a jar file.
 * Also generates a generic Dockerfile
 * @param targetdir Base directory for the Dockerfile
 * @param jarname Name of the jar file
 * @param services Services object to update
 */
async function addDockerComposeEntry(targetdir: string, jarname: String, services)
{  
    // drop explorviz- prefix of all files for naming as well as the .jar extension
    const name = jarname.replace("explorviz-", "").replace(".jar", "");
    services[name] = 
    {
        "build": 
        {
            "dockerfile": "docker/Dockerfile-" + name,
            "context": "."
        },
        "container_name": "explorviz-" + name,
        "depends_on": [ "mongo" ],
        "environment": [ "MONGO_IP=mongo" ]
    }

    // Create Dockerfile
    let file = await fs.readFile("./static/Dockerfile.base", "utf8");
    file = file.replace("%%%JAR%%%", jarname);
    await fs.writeFile(targetdir + "/docker/Dockerfile-" + name, file);
}