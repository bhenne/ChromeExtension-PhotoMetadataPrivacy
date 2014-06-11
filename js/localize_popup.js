/*
 *  Copyright (c) 2014 Benjamin Henne
 *                     Distributed Computing & Security Group,
 *                     Leibniz Universität Hannover, Germany.
 */

function localizeOptions() {
        document.getElementById("opt_respectSupportInputField").innerHTML = chrome.i18n.getMessage("opt_respectSupportInputField");
        document.getElementById("opt_doScan").innerHTML = chrome.i18n.getMessage("opt_doScan");
        document.getElementById("opt_hlUpload").innerHTML = chrome.i18n.getMessage("opt_hlUpload");
        document.getElementById("opt_hlScanImages").innerHTML = chrome.i18n.getMessage("opt_hlScanImages");
        document.getElementById("opt_qheadline").innerHTML = chrome.i18n.getMessage("opt_qheadline");
};

document.addEventListener('DOMContentLoaded', function() {
      localizeOptions();
});
