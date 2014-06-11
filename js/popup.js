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
    options = {};
    options['respectSupportInputField'] = $('#respectSupportInputField').prop('checked') ? 1 : 0;
    options['doScan'] = $('#doScan').prop('checked') ? 1 : 0;

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
    $('#respectSupportInputField').prop('checked', (options['respectSupportInputField']));
    $('#doScan').prop('checked', (options['doScan']));

}



$(document).ready(function() {
    getAndSendOptions(restore_options);

    Array.prototype.slice.call(document.querySelectorAll('input[type=checkbox]')).forEach(function(element) {
        element.addEventListener('click', save_options);
    });
    
});
