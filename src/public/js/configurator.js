var frontend;
var backend;

var timeout;

let build1 = ["frontend-extension-colorpicker", "frontend-extension-tutorial"]

loadConfigurator();

function loadConfigurator() {
  const removeButton = document.getElementById("removeButton");
  removeButton.addEventListener("click", () => {
    removeListItem(getFirstActiveListItem().id);
  });

  const removeAllButton = document.getElementById("removeAllButton");
  removeAllButton.addEventListener("click", () => {
    let item = getFirstActiveListItem();
    while (item !== null) {
      removeListItem(item.id);
      item = getFirstActiveListItem();
    }
  });

  const dependenciesButton = document.getElementById("dependenciesButton");
  dependenciesButton.addEventListener("click", () => {
    addAllDependencies();
  });

  fetch("/static/extensions")
    .then(data => {
      return data.json();
    })
    .then((response) => {
      frontend = response.frontend;
      backend = response.backend;
      let front = response.frontend;
      let back = response.backend;
      /**
       * Update the coumn of frontend extensions.
       */
      updateColumn("fe-column", front);

      /**
       * Update the column for backend extensions.
       */
      updateColumn("be-column", back);
    });

  /**
   * Initialize predefined builds.
   */
  fetch("/static/predefinedBuilds")
    .then(data => {
      return data.json();
    })
    .then((response) => {
      addPredefinedBuilds(response.builds);
    });
}

/**
 * TODO: comment
 * @param {String} colName
 * @param {Array} extensions
 */
function updateColumn(colName, extensions) {
  let column = document.getElementById(colName);
  let i;
  for (i = 0; i < extensions.length; i ++) {
    let element = extensions[i];
    let name = element.name;
    let img = document.createElement("img");
    img.classList.add("extension-img");
    img.id = name;
    checkImgSource(element.imgSrc)
      .then(
        (resp) => {img.src = resp;},
      );
    column.appendChild(img);
    img.addEventListener("error", () => {
      img.src = "img/logo-default.png";
    });
    img.addEventListener("click", () => {
        if (img.classList.contains("selected")) {
          removeClassFromElement(img, "selected");
          removeListItem("list-" + name);
        } else {
          addClassToElement(img, "selected");
          addListItem(name);
        }
    });
    img.addEventListener("mouseover", () => {
      addClassToElement(img, "hovered");
      showSelectedExtensionById(name);
      clearTimeout(timeout);
    });
    img.addEventListener("mouseout", () => {
      removeClassFromElement(img, "hovered");
      timeout = setTimeout(() => {showSelectedExtensionById(null); }, 100);
    });
  }
}

/**
 * Check if the image is a web or static resource. If neither is true use default image.
 * @param {String} imgSrc
 */
function checkImgSource(imgSrc) {
  if (imgSrc === null) {
    return Promise.reject();
  }
  if (imgSrc.startsWith("http")) {
    return Promise.resolve(imgSrc)
  } else {
    return Promise.resolve(
      $.ajax({
        type: "GET",
        url: "/static/img/" + imgSrc,
      }),
      );
    }
  }
  
/**
 * Remove one item by id from the currentBuildList.
 * @param {String} id
 */
function removeListItem(id) {
  let list = document.getElementById("currentBuildList");
  let child = document.getElementById(id);
  if (child !== null) {
    let imgId = child.id.substring(5);
    removeClassFromElement(document.getElementById(imgId), "selected");
    list.removeChild(child);
    if (list.childElementCount !== 0) {
      if (child.classList.contains("active")) {
      activateListItemById(list.children[list.childElementCount - 1].id);
      }
    } else {
      $("#removeButton").addClass("invisible");
      $("#removeAllButton").addClass("invisible");
    }
  }
  validateConfig();
}

/**
 * Add one item to the currentBuildList and link it to the
 * corresponding image via id.
 * @param {String} id
 */
function addListItem(id) {
  deactivateActiveListItems();
  let item = document.createElement("a");
  item.id = "list-" + id;
  item.classList.add("list-group-item");
  let content = document.createElement("h4");
  content.textContent = id.replace("extension-", "");
  content.classList.add("list-group-item-heading");
  item.appendChild(content);
  item.addEventListener("click", () => {
    if (!item.classList.contains("active")) {
      deactivateActiveListItems();
      activateListItemById("list-" + id);
    }
  });
  $(`#currentBuildList`).append(item);
  activateListItemById("list-" + id);
  $(`#${id}`).addClass("selected");
  validateConfig();
}

/**
 * Add the "active" class to an element determined by id.
 * @param {String} id
 */
function activateListItemById(id) {
  let item = document.getElementById(id);
  if (item !== null) {
    addClassToElement(item, "active");
    $(`#removeButton`).removeClass("invisible");
    $(`#removeAllButton`).removeClass("invisible");
    if (item.parentElement === document.getElementById("currentBuildList")) {
      showSelectedExtensionById(id.substring(5));
    }
  }
}

/**
 * Updates the info-box with information about an extension defined by id.
 * @param {String} id
 */
function showSelectedExtensionById(id) {
  clearSelection();
  if (id !== null) {
    let extension = getExtensionById(id);
    if (extension !== null) {
      setInfoBoxHeading(extension.name.replace("extension-", ""));
      let body = document.getElementById("info-box-body");
      let descHead = document.createElement("h4");
      let descContent = document.createElement("p");
      let reqContent = document.createElement("p");
      let reqHead = document.createElement("h4");
      descHead.textContent = "Description:";
      descContent.textContent = extension.desc;
      reqHead.textContent = "Required extensions:";
      let reqText = extension.requiredExtensions.toString();
      reqContent.textContent = reqText.replace("extension-", "").replace(/,/g, ", ");
      body.appendChild(descHead);
      body.appendChild(descContent);
      body.appendChild(reqHead);
      body.appendChild(reqContent);
      if (extension.incompatibleExtensions.length > 0) {
        let incHead = document.createElement("h4");
        incHead.textContent = "Incompatible with:";
        body.appendChild(incHead);
        let incContent = document.createElement("p");
        let incText = extension.incompatibleExtensions.toString()
        incContent.textContent = incText.replace("extension-", "").replace(/,/g, ", ");
        body.appendChild(incContent);
      }
      let urlContent = document.createElement("a");
      urlContent.textContent = "Visit GitHub repository";
      urlContent.href = extension.repository;
      urlContent.target = "_blank";
      body.appendChild(urlContent);
    }
  } else {
    let firstListItem = getFirstActiveListItem();
    if (firstListItem !== null) {
      showSelectedExtensionById(firstListItem.id.substring(5));
    } else {
      setInfoBoxHeading("Please select an extension.");
    }
  }
}

/**
 * Set the infoBoxHeading to heading.
 * @param {String} heading
 */
function setInfoBoxHeading(heading) {
  let header = document.getElementById("info-box-heading");
  let title = document.createElement("h3");
  let titleText = document.createElement("b");

  titleText.textContent = heading;
  title.appendChild(titleText);
  title.classList.add("panel-title");
  header.appendChild(title);
}

/**
 * Clears all content from the info-box.
 */
function clearSelection() {
  let heading = document.getElementById("info-box-heading");
  let body = document.getElementById("info-box-body");
  while (heading.firstChild) {
    heading.removeChild(heading.firstChild);
  }
  while (body.firstChild) {
    body.removeChild(body.firstChild);
  }
}


/**
 * Remove the active tag from all list items in the currentBuildList.
 */
function deactivateActiveListItems() {
  let list = document.getElementById("currentBuildList");
  let child = getFirstActiveListItem();
  if (child !== null) {
    removeClassFromElement(child, "active");
  }
}

/**
 * Returns the first item from currentBuildList that has the class "active".
 */
function getFirstActiveListItem() {
  let list = document.getElementById("currentBuildList");
  let listItem = null;
  if (list.hasChildNodes) {
    for (let i = 0; i < list.childElementCount; i++) {
      let child = list.children[i];
      if (child.classList.contains("active")) {
        listItem = child;
        break;
      }
    }
  }
  return listItem;
}

/**
 * Removes a class from an Element if present.
 * @param {Element} element
 * @param {String} cl
 */
function removeClassFromElement(element, cl) {
  if (element !== null && element.classList.contains(cl)) {
    element.classList.remove(cl);
  }
}

/**
 * Adds a class to an Element if not present.
 * @param {Element} element
 * @param {String} cl
 */
function addClassToElement(element, cl) {
  if (element !== null && !element.classList.contains(cl)) {
    element.classList.add(cl);
  }
}

/**
 * Search for an entry with id
 * @param {String} id
 */
function getExtensionById(id) {
  let extension = null;
  if (id.includes("backend")) {
    for (let i = 0; i < backend.length; i++) {
      if (backend[i].name === id) {
        extension = backend[i];
      }
    }
  } else if (id.includes("frontend")) {
    for (let i = 0; i < frontend.length; i++) {
      if (frontend[i].name === id) {
        extension = frontend[i];
      }
    }
  }
  return extension;
}

/**
 * Removes the required and incompatible classes from all extension-images.
 */
function removeValitdationMarks() {
  let images = document.getElementsByClassName("extension-img");
  for (let i = 0; i < images.length; i++) {
    removeClassFromElement(images[i], "required");
    removeClassFromElement(images[i], "incompatible");
  }
}

function continueOnClick(configuration) {
  console.log(configuration);
  $.ajax({
    data: configuration,
    success: (res) => {
      window.location = `/confirmation/${res}`;
    },
    type: "POST",
    url: "/build/post",
  });
}

/**
 * Activate the continue button if inactive.
 */
function activateContinueButton(configuration) {
  let continueButton = document.getElementById("continueButton");
  if (continueButton.classList.contains("btn-danger")) {
    removeClassFromElement(continueButton, "btn-danger");
    addClassToElement(continueButton, "btn-success");
    continueButton.addEventListener("click", () => continueOnClick(configuration));
  }
}

/**
 * Deactivate the continue button if active.
 */
function deactivateContinueButton() {
  let continueButton = document.getElementById("continueButton");
  if (continueButton.classList.contains("btn-success")) {
    removeClassFromElement(continueButton, "btn-success");
    addClassToElement(continueButton, "btn-danger");
    continueButton.removeEventListener("click", () => continueOnClick());
  }
}

/**
 * Validates the current config by checking the requirements and incompatibilities
 * of all elements corresponding to the children of currentBuildList.
 */
function validateConfig() {
  removeValitdationMarks();
  const status = {
    incompatible: [],
    required: [],
    wanted: [],
  };
  let list = document.getElementById("currentBuildList");
  if (list.childElementCount > 0) {
    for (let i = 0; i < list.childElementCount; i++) {
      let childId = list.children[i].id.substring(5);
      let extensions = getExtensionById(childId);
      status.wanted.push(extensions);
      extensions.requiredExtensions.forEach(requiredExtension => {
        let element = document.getElementById(requiredExtension);
        try {
          if (!element.classList.contains("selected")) {
            addClassToElement(element, "required");
            if (status.required.indexOf(requiredExtension) === -1 ) {
              status.required.push(requiredExtension);
            }
          }
        } catch (error) {
          $(`#${childId}`).addClass("incompatible");
          console.log("Required extension: " + requiredExtension + " for " + childId + " not found: " + error.message);
          alert("Required extension: " + requiredExtension + " for " + childId + " not found.");
          status.incompatible.push(childId);
        }
      });
      extensions.incompatibleExtensions.forEach(incompatibleExtension => {
        let element = document.getElementById(incompatibleExtension);
        if (element !== null && element.classList.contains("selected")) {
          addClassToElement(element, "incompatible");
          addClassToElement($(`#${childId}`).get(0), "incompatible");
          if (status.incompatible.indexOf(incompatibleExtension) === -1 ) {
            status.incompatible.push({childId, incompatibleExtension});
          }
        }
      });
    }
  }
  if (status.wanted.length > 0
        && status.required.length === 0
        && status.incompatible.length === 0) {
    activateContinueButton({config: trimConfig(status.wanted)});
  } else {
    deactivateContinueButton();
  }
}

/**
 * Add all dependencies of selected extensions to the current build list.
 */
function addAllDependencies() {
  let list = document.getElementById("currentBuildList");
  if (list.childElementCount > 0) {
    for (let i = 0; i < list.childElementCount; i++) {
      let childId = list.children[i].id.substring(5);
      let extensions = getExtensionById(childId);
      extensions.requiredExtensions.forEach(requiredExtension => {
        if (!buildListHasExtension(requiredExtension)
            && getExtensionById(requiredExtension) !== null) {
          addListItem(requiredExtension);
        }
      });
    }
  }
}

/**
 * Check if an extension with the id is present in the build list.
 * @param {String} id
 */
function buildListHasExtension(id) {
  let hasExtension = false;
  let list = document.getElementById("currentBuildList");
  if (list.childElementCount > 0) {
    for (let i = 0; i < list.childElementCount; i++) {
      let childId = list.children[i].id.substring(5);
      if (childId === id) {
        hasExtension = true;
      }
    }
  }
  return hasExtension;
}

/**
 * Trims an array of extensions to contain only build-relevant information.
 * @param {Extension[]} extensions
 */
function trimConfig(extensions) {
  let config = [];
  for (const extension of extensions) {
    const newExtension = {
      extensionType: extension.extensionType,
      name: extension.name,
      repository: extension.repository,
      version: extension.version,
    };
    config.push(newExtension);
  }
  return config;
}

/**
 * Add an array of ids with their dependencies to the current build list and select
 * their respective images.
 */
function addListItems(ids) {
  ids.forEach(id => {
    addListItem(id)
  })
  addAllDependencies();
}

/**
 * Add the builds obtained from predefinedBuilds.json to the list.
 * @param builds 
 */
function addPredefinedBuilds(builds) {
  const buildArr = Array.from(builds);
  const buildSelector = document.getElementById("buildSelector");
  buildArr.forEach(build => {
    let selector = document.createElement("li")
    let link = document.createElement("a")
    link.textContent = build.name
    link.addEventListener("click", () => {
      let item = getFirstActiveListItem();
      while (item !== null) {
        removeListItem(item.id);
        item = getFirstActiveListItem();
      }
      addListItems(build.content);
    })
    selector.appendChild(link);
    buildSelector.appendChild(selector);
  });
}
