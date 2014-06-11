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


metaTagsInfo = {};

metaDB = {};
metaDB.db = null;
metaDB.open = function() {
    var version = 1;
    var request = indexedDB.open("metatags", version);

    // We can only create Object stores in a versionchange transaction.
    request.onupgradeneeded = function(e) {
        var db = e.target.result;

        // A versionchange transaction is started automatically.
        e.target.transaction.onerror = metaDB.onerror;

        if (db.objectStoreNames.contains("metatag")) {
            db.deleteObjectStore("metatag");
        }

        var store = db.createObjectStore("metatag",
                {keyPath: "key"});
    };

    request.onsuccess = function(e) {
        metaDB.db = e.target.result;
        metaDB.getAllMetaTags();
    };

    request.onerror = metaDB.onerror;
};

metaDB.addMetaTag = function(metatag) {
    var request = metaDB.db.transaction(["metatag"], "readwrite").objectStore("metatag").put(metatag);

    request.onsuccess = function(e) {
        metaDB.getAllMetaTags();
    };

    request.onerror = function(e) {
        console.log(e.value);
    };
};

metaDB.getAllMetaTags = function() {
    var keyRange = IDBKeyRange.lowerBound(0);
    // Get everything in the store;
    var cursorRequest = metaDB.db.transaction(["metatag"], "readwrite").objectStore("metatag").openCursor(keyRange);

    cursorRequest.onsuccess = function(e) {
        var result = e.target.result;
        if (!!result == false) {
            metaDB.gotAllMetaTags();
        } else {
            metaTagsInfo[result.key] = result.value;
            result.continue();
        }

    };

    cursorRequest.onerror = metaDB.onerror;
};

metaDB.gotAllMetaTags = function() {
    if (objLength(metaTagsInfo)) {
        console.log("metaTagsInfo saved in DB");
    } else {
        console.log("loading metaTagsInfo from json");

        $.getJSON('/data/metatags.json', function(json) {
            var metatags = $.extend({}, json.exifTags, json.iptcTags, json.xmpTags);
            for (var metatag in metatags) {
                metaDB.addMetaTag(metatags[metatag]);
            }
        }).fail(function(jqxhr, textStatus, error) {
            var err = textStatus + ", " + error;
            console.log("Request Failed: " + err);
        });
    }
}

metaDB.open();

/*
groups:
-1 ignore
0 show on request
1 who
2 where
3 when 
4 what/extra/context

*/
