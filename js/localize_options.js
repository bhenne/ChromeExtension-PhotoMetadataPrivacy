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
        document.getElementById("opt_headline").innerHTML = chrome.i18n.getMessage("opt_headline");
        document.getElementById("opt_hlSidebarUI").innerHTML = chrome.i18n.getMessage("opt_hlSidebarUI");
        document.getElementById("opt_hlOverlayIcons").innerHTML = chrome.i18n.getMessage("opt_hlOverlayIcons");
        document.getElementById("opt_hlBlacklist").innerHTML = chrome.i18n.getMessage("opt_hlBlacklist");
        document.getElementById("opt_SidebarUI_thbwidth").innerHTML = chrome.i18n.getMessage("opt_SidebarUI_thbwidth");
        document.getElementById("opt_SidebarUI_thbheight").innerHTML = chrome.i18n.getMessage("opt_SidebarUI_thbheight");
        document.getElementById("opt_ScanRules_intro").innerHTML = chrome.i18n.getMessage("opt_ScanRules_intro");
        document.getElementById("opt_ScanRules_minwidth").innerHTML = chrome.i18n.getMessage("opt_ScanRules_minwidth");
        document.getElementById("opt_ScanRules_minheight").innerHTML = chrome.i18n.getMessage("opt_ScanRules_minheight");
        document.getElementById("opt_ScanRules_AND").innerHTML = chrome.i18n.getMessage("opt_ScanRules_AND");
        document.getElementById("opt_Blacklist_descr").innerHTML = chrome.i18n.getMessage("opt_Blacklist_descr");
        document.getElementById("opt_OverlayIconsQuickAccess").innerHTML = chrome.i18n.getMessage("opt_OverlayIconsQuickAccess");
        document.getElementById("opt_OverlayIconsShow1").innerHTML = chrome.i18n.getMessage("opt_OverlayIconsShow");
        document.getElementById("opt_OverlayIconsShow2").innerHTML = chrome.i18n.getMessage("opt_OverlayIconsShow");
        document.getElementById("opt_OverlayIconsShow3").innerHTML = chrome.i18n.getMessage("opt_OverlayIconsShow");
        document.getElementById("opt_OverlayIconsShow4").innerHTML = chrome.i18n.getMessage("opt_OverlayIconsShow");
        document.getElementById("group_people").innerHTML = chrome.i18n.getMessage("group_people");
        document.getElementById("group_location").innerHTML = chrome.i18n.getMessage("group_location");
        document.getElementById("group_datetime").innerHTML = chrome.i18n.getMessage("group_datetime");
        document.getElementById("group_content").innerHTML = chrome.i18n.getMessage("group_content");
        document.getElementById("opt_OverlayIconsNone").innerHTML = chrome.i18n.getMessage("opt_OverlayIconsNone");
        document.getElementById("opt_empty_fields").innerHTML = chrome.i18n.getMessage("opt_empty_fields");
        document.getElementById("btn_save").innerHTML = chrome.i18n.getMessage("btn_save");
        document.getElementById("showExtendedMetaSettings").innerHTML = chrome.i18n.getMessage("showExtendedMetaSettings");
        document.getElementById("opt_editMDDB").innerHTML = chrome.i18n.getMessage("opt_editMDDB");
        document.getElementById("opt_editMDDB_key").innerHTML = chrome.i18n.getMessage("opt_editMDDB_key");
        document.getElementById("opt_editMDDB_type").innerHTML = chrome.i18n.getMessage("opt_editMDDB_type");
        document.getElementById("opt_editMDDB_descr").innerHTML = chrome.i18n.getMessage("opt_editMDDB_descr");
        document.getElementById("opt_editMDDB_group").innerHTML = chrome.i18n.getMessage("opt_editMDDB_group");
        document.getElementById("opt_editMDDB_privat").innerHTML = chrome.i18n.getMessage("opt_editMDDB_privat");
};

document.addEventListener('DOMContentLoaded', function() {
      localizeOptions();
});
