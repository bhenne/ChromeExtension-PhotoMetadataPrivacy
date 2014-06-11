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


function save_options() {
    $this = $(this);
    if ($this.hasClass('noAutoSave')) {
        return;
    }
    options = {};
    options['conditionAnd'] = $('#conditionAnd').prop('checked') ? 1 : 0;
    options['showEmptyMeta'] = $('#showEmptyMeta').prop('checked') ? 1 : 0;

    options['showNoMetaIcon'] = $('#showNoMetaIcon').prop('checked') ? 1 : 0;
    options['showIconGroup0'] = $('#showIconGroup0').prop('checked') ? 1 : 0;
    options['showIconGroup1'] = $('#showIconGroup1').prop('checked') ? 1 : 0;
    options['showIconGroup2'] = $('#showIconGroup2').prop('checked') ? 1 : 0;
    options['showIconGroup3'] = $('#showIconGroup3').prop('checked') ? 1 : 0;
    options['showIconGroup4'] = $('#showIconGroup4').prop('checked') ? 1 : 0;

    options['respectSupportInputField'] = $('#respectSupportInputField').prop('checked') ? 1 : 0;
    options['doScan'] = $('#doScan').prop('checked') ? 1 : 0;

    options['conditionMinHeight'] = parseInt($('#conditionMinHeight').val());
    options['conditionMinWidth'] = parseInt($('#conditionMinWidth').val());
    options['thumbsHeight'] = parseInt($('#thumbsHeight').val());

    options['GUIWidth'] = parseInt($('#GUIWidth').val());
    if (options['GUIWidth'] < 200)
        options['GUIWidth'] = 200;

    blacklist = $('#blacklist').val().split("\n")
    blacklist = $.grep(blacklist, function(n) {
        return(n);
    });

    options['blacklist'] = blacklist;

    chrome.storage.sync.set(options, function() {
        // perhaps change extension icon       
        getAndSendOptions(restore_options);
        var status = $(".status");
        status.html("Einstellungen gespeichert!");
        status.show();
        setTimeout(function() {
            status.hide();
        }, 3000);
    });
}

function restore_options(options) {
    $('#loading').hide();
    $('#options').show();
    $('#conditionAnd').prop('checked', (options['conditionAnd']));
    $('#showEmptyMeta').prop('checked', (options['showEmptyMeta']));

    $('#showNoMetaIcon').prop('checked', (options['showNoMetaIcon']));
    $('#showIconGroup0').prop('checked', (options['showIconGroup0']));
    $('#showIconGroup1').prop('checked', (options['showIconGroup1']));
    $('#showIconGroup2').prop('checked', (options['showIconGroup2']));
    $('#showIconGroup3').prop('checked', (options['showIconGroup3']));
    $('#showIconGroup4').prop('checked', (options['showIconGroup4']));

    $('#respectSupportInputField').prop('checked', (options['respectSupportInputField']));
    $('#doScan').prop('checked', (options['doScan']));

    $('#conditionMinHeight').val(options['conditionMinHeight']);
    $('#conditionMinWidth').val(options['conditionMinWidth']);
    $('#thumbsHeight').val(options['thumbsHeight']);

    $('#GUIWidth').val(options['GUIWidth']);

    $('#blacklist').val(options['blacklist'].join('\n'));

}

metaTagsInfo = {};
function getMetaTagsInfo(callback) {
    chrome.runtime.sendMessage({
        task: "getOptions"
    }, (function(callback) {
        return function(response) {
            metaTagsInfo = response.metaTagsInfo;
            callback();
        };
    })(callback));
}

/*
 groups:
 -1 ignore
 0 show on request
 1 who
 2 where
 3 when 
 4 what/extra/context
 
 */



function clickShowExtendedMetaSettings(e) {
    e.preventDefault();
    e.stopPropagation();
    $('#metatagssettingsContainer').show();
    $('#showExtendedMetaSettings').remove();
    $('html, body').animate({
        scrollTop: $("#metatagssettingsContainer").offset().top
    }, 1000);

    getMetaTagsInfo(function() {
        function getSelect(tagGroupKey) {
            var groupNames = {"0": "-", "1": "Person", "2": "Ort", "3": "Zeit", "4": "Inhalt"};
            $select = $('<select>');
            for (groupKey in groupNames) {
                $select.append('<option' + (groupKey == tagGroupKey ? ' selected' : '') + ' value="' + groupKey + '">' + groupNames[groupKey] + '</option>');
            }
            return $select.wrap("<span></span>").parent().html();
        }
        for (var key in metaTagsInfo) {
            var tag = metaTagsInfo[key];
            if (tag.group < 0) {
                continue;
            }
            var $tr = $('<tr><td>' + tag.key + '</td><td>' + tag.type + '</td><td>' + tag.desc +
                    '</td><td>' + getSelect(tag.group) + '</td><td><input type="checkbox"' + (tag.important == 1 ? " checked" : "") + ' /></td></tr>').data("data-metatag", tag);

            $tr.appendTo('#metatagssettings');
        }

        $('#metatagssettings select').change(function() {
            $this = $(this);
            var group = $this.val();
            var metatag = $this.parents('tr').data("data-metatag");
            metatag.group = group;

            chrome.runtime.sendMessage({
                task: "editMetaTagInfo",
                metatag: metatag
            });

            $this.parents('tr').effect("highlight", {
                color: 'rgba(0, 200, 0, .5)'
            }, 1200);
        });

        $('#metatagssettings input[type=checkbox]').click(function() {
            $this = $(this);
            var important = $this.is(':checked');
            var metatag = $this.parents('tr').data("data-metatag");
            metatag.important = important ? 1 : 0;

            chrome.runtime.sendMessage({
                task: "editMetaTagInfo",
                metatag: metatag
            });

            $this.parents('tr').effect("highlight", {
                color: 'rgba(0, 200, 0, .5)'
            }, 1200);
        });

        $('#metatagssettingsContainer .loadingInline').hide();
        $('#metatagssettingsContainer .loadingHide').show();

    });
}

$(document).ready(function() {
    getAndSendOptions(restore_options);
    Array.prototype.slice.call(document.querySelectorAll('.save, input[type=checkbox]')).forEach(function(element) {
        element.addEventListener('click', save_options);
    });
    $('input[type=text]').on('change', save_options);

    $('#showExtendedMetaSettings').click(clickShowExtendedMetaSettings);
});
