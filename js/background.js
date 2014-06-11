/*
 *  Copyright (c) 2013 Maximilian Koch, Benjamin Henne
 *                     Distributed Computing & Security Group,
 *                     Leibniz Universität Hannover, Germany.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */


photoMetadataPrivacyModule = null;  // Global application object.
statusText = 'NO-STATUS';

// Indicate success when the NaCl module has loaded.
function moduleDidLoad() {
    photoMetadataPrivacyModule = document.getElementById('photo_metadata_privacy');
    updateStatus('SUCCESS');
}

// If the page loads before the Native Client module loads, then set the
// status message indicating that the module is still loading.  Otherwise,
// do not change the status message.
function pageDidLoad() {
    if (photoMetadataPrivacyModule == null) {
        updateStatus('LOADING...');
    } else {
        // It's possible that the Native Client module onload event fired
        // before the page's onload event.  In this case, the status message
        // will reflect 'SUCCESS', but won't be displayed.  This call will
        // display the current message.
        updateStatus();
    }
}

// Set the global status message.  If the element with id 'statusField'
// exists, then set its HTML to the status message as well.
// opt_message The message test.  
function updateStatus(opt_message) {
    if (opt_message) {
        statusText = opt_message;
    }
    var statusField = document.getElementById('statusField');
    if (statusField) {
        statusField.innerHTML = statusText;
    }
}

//save sendResponse for asynchronous response
responsePointerIndex = 0;
responseMap = new Array();
function getResponsePointer(sendResponse) {
    responsePointerIndex++;
    responseMap[responsePointerIndex] = sendResponse;
    return responsePointerIndex;
}

// Handle a message coming from the NaCl module.
function handleMessage(message_event) {
    //nacl should always respond with a json string. otherwise there is an error
    try {
        data = JSON.parse(message_event.data);
    } catch (e) {
        console.log("Error: " + e.message);
        return false;
    }
    responseMap[data.responsePointer](data);
    return true;
}

chrome.runtime.onMessage.addListener(
        function(request, sender, sendResponse) {
            if (request.task == "getOptions") {
                getAndSendOptions((function(sendResponse) {
                    return function(options) {
                        sendResponse({options: options, metaTagsInfo: metaTagsInfo});
                    };
                })(sendResponse));
                return true;
            }
            if (request.task == 'editMetaTagInfo') {
                metaDB.addMetaTag(request.metatag);
                return true;
            }
            // we have the sendResponse function to use it when the nacl-module responses
            rp = getResponsePointer(sendResponse);
            request.responsePointer = rp;
            photoMetadataPrivacyModule.postMessage(JSON.stringify(request));
            return true;
        });

// Add conext menu for images
chrome.contextMenus.create({
    title: "Show Meta Data",
    contexts: ["image"],
    onclick: function(evt, tab) {
        // the image must have a source to process
        if (!evt.srcUrl) {
            alert("Es trat ein Fehler auf!");
            return false;
        }

        chrome.tabs.sendMessage(tab.id, {"task": "getRightClickedElement"}, function(response) {
            var name = typeof response.name == "undefined" || response.name == "" ? response.title : response.name;
            rp = getResponsePointer((function(tabid, name) {
                return function(json) {
                    json.task = "showMeta";
                    json.name = name;
                    chrome.tabs.sendMessage(tabid, json);
                };
            })(tab.id, name));
            // tell the content script in that tab, that we are going to load an image  
            chrome.tabs.sendMessage(tab.id, {"task": "loading", "url": evt.srcUrl, "responsePointer": rp});
            // the image may be provided as data-url or as normal url
            if (evt.srcUrl.search(/data/i) === 0) {
                photoMetadataPrivacyModule.postMessage(JSON.stringify({'responsePointer': rp, "task": 'getMetaByDataUrl', "fileData": evt.srcUrl, "url": ""}));
            } else {
                photoMetadataPrivacyModule.postMessage(JSON.stringify({'responsePointer': rp, "task": 'getMetaByUrl', "fileData": "", "url": evt.srcUrl}));
            }
        });
    }
});

// Add event listeners once the DOM has fully loaded by listening for the
// `DOMContentLoaded` event on the document, and adding your listeners to
// specific elements when it triggers.
document.addEventListener('DOMContentLoaded', function() {
    var listener = document.getElementById('listener')
    listener.addEventListener('load', moduleDidLoad, true);
    listener.addEventListener('message', handleMessage, true);
    pageDidLoad();
});
