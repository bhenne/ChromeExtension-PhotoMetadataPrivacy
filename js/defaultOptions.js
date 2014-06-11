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


defaultOptions = {
    showNoMetaIcon: 0,
    conditionAnd: 1,
    conditionMinHeight: 100,
    conditionMinWidth: 100,
    respectSupportInputField: 1,
    showEmptyMeta: 0,
    showIconGroup0: 0,
    showIconGroup1: 1,
    showIconGroup2: 1,
    showIconGroup3: 1,
    showIconGroup4: 1,
    showIconGroup5: 1,
    thumbsHeight: 150,
    GUIWidth: 400,
    doScan: 1,
    blacklist: ['.*tile.openstreetmap.org.*','.*tiles.virtualearth.net.*','.*google.com/vt.*', '.*maps.gstatic.com/.*', '.*google.de/kh/.*']
}

options = null;

function getAndSendOptions(response) {    
    chrome.storage.sync.get(null, (function(response) { return function(TMPoptions){
        options = TMPoptions;   
      
        if (!options.doScan) {
            chrome.browserAction.setIcon({path: {                   
                "19": "images/icon-19-gray.png",          
                "38": "images/icon-38-gray.png"           
              }});
        } else {
            chrome.browserAction.setIcon({path: {                   
                "19": "images/icon-19.png",          
                "38": "images/icon-38.png"           
              }});
        }
        response(options);
    };})(response));    
}

//check if there are all options saved in storage. otherwise insert default values
chrome.storage.sync.get(null, function(TMPoptions){
        missingOptions = [];
        for (defaultOption in defaultOptions) {
            if (TMPoptions[defaultOption] == undefined || TMPoptions[defaultOption] == "undefined") {
                missingOptions.push(defaultOption);
            }
        }
        
        addOptions = {};
        for (i=0;i<missingOptions.length;i++) {          
            addOptions[missingOptions[i]] = defaultOptions[missingOptions[i]];
        }
        
        if (objLength(addOptions)) {
            chrome.storage.sync.set(addOptions, function(){             
                getAndSendOptions(function(x){});
            }); 
        }        
    });
    

