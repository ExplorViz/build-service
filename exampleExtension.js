module.exports = {
    generateExampleExtensionsJSON,
    getMissingImageDummyFE,
    getMissingImageDummyBE,
    getNewVrDummyFE,
    getNewVrDummyBE
};

/**
 * Generate new dummy extensions
 */

const fs = require('fs');
const https = require('https');
const removeMd = require('remove-markdown'); 
const status = require('http-status');

var evDesc = "ExplorViz uses dynamic analysis techniques to provide live trace visualization of the communication in large software landscape. It targets system and program comprehension in those landscapes while still providing details on the communication within an application. A landscape perspective enriches current system visualizations with additional abstraction levels for efficient comprehension of communication between hundreds of applications which is often encountered in, for instance, Cloud environments. On the application level perspective, ExplorViz utilizes the 3D city metaphor combined with an interactive concept of showing only details that are in focus of the analysis. For best accessibility, ExplorViz is a web-based tool featuring cutting-edge technologies like WebGL and HTML 5.";
var beDesc = "This extension adds features to the backend of ExplorViz to enable a multi-user VR-experience. The related frontend extension is explorviz-frontend-extension-vr.";
var feDesc = "This extension adds a WebVR-based Virtual Reality (VR) mode to ExplorViz, which allows collaborative exploration.";
var lorIp = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas sed diam eget risus varius blandit sit amet non magna. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent commodo cursus magna, vel scelerisque nisl consectetur et. Cras mattis consectetur purus sit amet fermentum. Duis mollis, est non commodo luctus, nisi erat porttitor ligula, eget lacinia odio sem nec elit. Aenean lacinia bibendum nulla sed consectetur.";

/**
 * This is the constructor for data representation of relevant information for building and extension.
 * @param {String} name 
 * @param {String} desc 
 * @param {String} imgUrl 
 * @param {String[]} requiredExtensions 
 * @param {String[]} incompatibleExtensions 
 * @param {String} url 
 * @param {String} version 
 */
function Extension(name, desc, imgUrl, requiredExtensions, incompatibleExtensions, url, version) {
    this.name = name;
    this.desc = desc;
    this.imgUrl = imgUrl;
    this.requiredExtensions = requiredExtensions;
    this.incompatibleExtensions = incompatibleExtensions;
    this.url = url;
    this.version = version;
}

function getMissingImageDummyBE() {
    return new Extension(
        "backend-missing-image-dummy", 
        lorIp, 
        "",
        ["backend"], 
        [],
        "https://www.google.com",
        "1.0"
    );
}

function getMissingImageDummyFE() {
    return new Extension(
        "frontend-missing-image-dummy", 
        lorIp, 
        "",
        ["frontend"], 
        [],
        "https://www.google.com",
        "1.0"
    );
}

function getNewVrDummyFE() {
    return new Extension(
        "frontend-extension-new-vr", 
        feDesc, 
        "img/vr.png",
        ["backend", "frontend", "backend-extension-new-vr"], 
        ["frontend-extension-vr"],
        "https://github.com/ExplorViz/explorviz-frontend-extension-vr",
        "1.1"
    );
}

function getNewVrDummyBE() {
    return new Extension(
        "backend-extension-new-vr", 
        beDesc,
        "img/vr.png", 
        ["backend", "frontend", "frontend-extension-new-vr"], 
        ["backend-extension-vr"],
        "https://github.com/ExplorViz/explorviz-backend-extension-vr",
        "1.1"
    );
}

/**
 * Generates an example extension.json file with mostly dummy extensions.
 */
function generateExampleExtensionsJSON() {
    
    const ext1 = new Extension("backend-extension-vr", 
                                beDesc,
                                "img/vr.png", 
                                ["backend", "frontend", "frontend-extension-vr"], 
                                [],
                                "https://github.com/ExplorViz/explorviz-backend-extension-vr",
                                "1.0"
    );
    
    const ext3 = new Extension("backend-extension-new-vr", 
                                beDesc,
                                "img/vr.png", 
                                ["backend", "frontend", "frontend-extension-new-vr"], 
                                ["backend-extension-vr"],
                                "https://github.com/ExplorViz/explorviz-backend-extension-vr",
                                "1.1"
    );
    
    const ext5 = new Extension("backend", 
                                evDesc,
                                "img/logo-be.png", 
                                ["frontend"], 
                                [],
                                "https://github.com/ExplorViz/explorviz-backend",
                                "1.0"
    );
    
    const ext2 = new Extension("frontend-extension-vr", 
                                feDesc,
                                "img/vr.png", 
                                ["backend", "frontend", "backend-extension-vr"], 
                                [],
                                "https://github.com/ExplorViz/explorviz-frontend-extension-vr",
                                "1.0"
    );  
    const ext4 = new Extension("frontend-extension-new-vr", 
                                feDesc, 
                                "img/vr.png",
                                ["backend", "frontend", "backend-extension-new-vr"], 
                                ["frontend-extension-vr"],
                                "https://github.com/ExplorViz/explorviz-frontend-extension-vr",
                                "1.1"
    );
    
    const ext6 = new Extension("frontend", 
                                evDesc, 
                                "img/logo-fe.png",
                                ["backend"], 
                                [],
                                "https://github.com/ExplorViz/explorviz-frontend",
                                "1.0"
    );
    
    const ext7 = new Extension("backend-missing-image-dummy", 
                                lorIp, 
                                "",
                                ["backend"], 
                                [],
                                "https://www.google.com",
                                "1.0"
    );
    
    const ext8 = new Extension("frontend-missing-image-dummy", 
                                lorIp, 
                                "",
                                ["frontend"], 
                                [],
                                "https://www.google.com",
                                "1.0"
    );
    
    var front = [];
    var back = [];
    
    back.push(ext5);
    front.push(ext6);
    back.push(ext1);
    front.push(ext2);
    back.push(ext3);
    front.push(ext4);
    
    for (let i = 0; i<8; i++) {
        let fd = new Extension("frontend-extension-dummy" + i,
        lorIp+lorIp+lorIp+lorIp,
        "img/logo-fe.png",
        ["frontend"],
        [],
        "https://www.google.com",
        "1.0"
        );
        let bd = new Extension("backend-extension-dummy" + i,
        lorIp,
        "img/logo-be.png",
        ["backend"],
        [],
        "https://www.google.com",
        "1.0"
        );  
        front.push(fd)
        back.push(bd)
    }
    
    back.push(ext7);
    front.push(ext8);
    
    var newJson = {
        frontend : front,
        backend: back
    };
    
    fs.writeFileSync('extensions.json', JSON.stringify(newJson, null, 2), function (err) {
        if(err !== null) {
            console.log(err);
        }
    });
    
    console.log(`Generated ${front.length} frontend and ${back.length} backend extensions.`)
}