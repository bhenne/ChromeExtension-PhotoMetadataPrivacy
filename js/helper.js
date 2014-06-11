/*
 *  Copyright (c) 2013 Maximilian Koch, Benjamin Henne
 *                     Distributed Computing & Security Group,
 *                     Leibniz Universität Hannover, Germany.
 */


function dataURItoBlob(dataURI) {
    // *this function has been inspired by different stackoverflow posts*
    // convert base64 to raw binary data held in a string
    // doesn't handle URLEncoded DataURIs
    var byteString;
    if (dataURI.split(",")[0].indexOf("base64") >= 0) {
        byteString = atob(dataURI.split(",")[1]);
    } else {
        byteString = unescape(dataURI.split(",")[1]);
    }
    // separate out the mime component
    var mimeString = dataURI.split(",")[0].split(":")[1].split(";")[0];
    // write the bytes of the string to an ArrayBuffer
    var ab = new ArrayBuffer(byteString.length);
    var ia = new Uint8Array(ab);
    for (var i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    // write the ArrayBuffer to a blob, and you're done
    var dataView = new DataView(ab);
    var blob = new Blob([dataView], {type: mimeString});
    return blob;
}

function objLength(obj) {
    length = 0;
    for (key in obj) {
        if (obj.hasOwnProperty(key))
            length++;
    }
    return length;
}

//this function is for metadata objects
function objToArray(obj) {
    ret = [];
    for (i = 0; i < objLength(obj); i++) {
        if (!(i in obj || !obj.hasOwnProperty(i))) {
            console.log("objToArray Error: object does not contain key " + i);
            return false;
        }
        ret[i] = obj[i];
    }
    return ret;
}

function escapeJQuerySelect(selector) {
    firstChar = '';
    selectorTmp = selector;
    if (selector[0] && (selector[0] == '#' || selector[0] == '.')) {
        firstChar = selector[0];
        selectorTmp = selector.substr(1);
    }
    return firstChar + selectorTmp.replace(/[#;&,.+*~':"!^$[\]()=>|\/]/g, "\\$&");
}

function metaKeyToTitle(key) {
    function Numsort(a, b) {
        return -(a - b);
    }
    //the title is always after the last occurence of '/', ':' or '.'
    lastPos = [key.lastIndexOf("/"), key.lastIndexOf(":"), key.lastIndexOf(".")];
    lastPos.sort(Numsort);
    title = key.substr(lastPos[0] + 1);
    return translate(title);
}

function translate(from) {
    to = chrome.i18n.getMessage(from);
    //unfortunately the i18n translation returns empty strings for undefined keys
    // in that case we use the key as title
    return to == '' ? from : to;
}

function escapeRegex(str) {
    return str.replace(/[-[\]{}()*+?.,\\^$|#\s\/]/g, "\\$&");
}

function findMetaDatum(meta, key, value) {
    if (!Array.isArray(meta)) {
        meta = objToArray(meta);
    }
    for (i = 0; i < meta.length; i++) {
        if (meta[i][key] == value) {
            return meta[i];
        }
    }
    return null;
}

function deleteMetaDatum(key, meta) {
    for (type in meta) {
        if (!Array.isArray(meta)) {
            meta[type] = objToArray(meta[type]);
        }

        for (var i = meta[type].length - 1; i >= 0; i--) {
            if (meta[type][i].key.search(key) == 0) {
                meta[type].splice(i, 1);
            }
        }
    }

    return meta;
}

function ignoreMetaData(key, meta) {
    for (type in meta) {
        if (!Array.isArray(meta)) {
            meta[type] = objToArray(meta[type]);
        }

        for (var i = meta[type].length - 1; i >= 0; i--) {
            if (meta[type][i].key.search(key) == 0) {
                meta[type][i].ignore = true;
            }
        }
    }

    return meta;
}
