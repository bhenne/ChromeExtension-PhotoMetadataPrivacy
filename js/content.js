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


// Represents an image file
function ImgFile(name, type, fileData) {
    this.name = name;
    this.type = type;
    this.fileData = fileData;
    this.meta = {
        exif: null,
        iptc: null,
        xmp: null
    };
    this.width = false;
    this.height = false;
    this.size = false;
    this.mime = false;
    this.thumb = false;
    this.deleted = false;
    this.lat = false;
    this.lng = false;
    this.flickrMeta = false;
}

// List of images
function ImgFiles() {
    // may only contain these types of files
    this.image_types = ["image/jpeg", "image/png"];

    this.files = {};
    var that = this;
    this.addImageFile = function(inputName, fileIndex, name, type, fileData) {
        if (!(inputName in that.files)) {
            that.files[inputName] = [];
        }
        that.files[inputName][fileIndex] = new ImgFile(name, type, fileData);
    };
    this.changeFile = function(inputName, fileIndex, name, value) {
        that.files[inputName][fileIndex][name] = value;
    };
    // is there any image in this object, that has to be processed?
    this.hasImages = function() {
        for (inputName in that.files) {
            for (fileIndex = 0; fileIndex < that.files[inputName].length; fileIndex++) {
                if (!that.files[inputName][fileIndex].deleted) {
                    return true;
                }
            }
        }
        return false;
    };
}

// submit handler for form fields
handleSubmit = function(submitEvent) { 
    imgFiles.files = {};
    // we do not want the form to submit until we allow it
    submitEvent.preventDefault();
    // lets keep track if this form contains images
    hasFiles = false;
    form = submitEvent.target;
    fileInputs = $(form).find('input[type=file]');
    sendMessageWait = 0;
    $.each(fileInputs, function(inputKey, fileInput) {
        sendMessageWait += fileInput.files.length;
    });

    $.each(fileInputs, function(inputKey, fileInput) {
        var files = fileInput.files;
        var inputName = $(fileInput).attr('name');
        // keep track if THIS input field of the form contains at least one image

        for (var fileIndex = 0, file; file = files[fileIndex]; fileIndex++) {
            // we may only permit certain image types
            if ($.inArray(file.type, imgFiles.image_types) == -1) {
                continue;
            }
            if (!hasFiles) {
                showLoading(true);
            }
            // now we have at least one image in the form and in THIS input field
            hasFiles = true;
            // so lets read the images 			
            var reader = new FileReader();
            reader.onload = (function(file2, fileIndex2, inputName2) {
                return function(onloadEvent) {
                    // we save the image for futher use(dsplay/submit)                
                    imgFiles.addImageFile(inputName2, fileIndex2, file2.name, file2.type, onloadEvent.target.result);
                    // and send the image data to the extension background
                    chrome.runtime.sendMessage({
                        task: "getMetaByDataUrl",
                        fileData: onloadEvent.target.result
                    },
                    (function(file3, fileIndex3, inputName3) {
                        return function(response) {

                            var hasMeta = false;
                            for (type in response.meta) {
                                for (var anyKey in response.meta[type]) {
                                    hasMeta = true;
                                    break;
                                }
                            }

                            if (!hasMeta || response == undefined || response.error) {
                                imgFiles.changeFile(inputName3, fileIndex3, 'deleted', true);
                            } else {

                                //save the meta data
                                imgFiles.changeFile(inputName3, fileIndex3, 'fileData', response.fileData);
                                imgFiles.changeFile(inputName3, fileIndex3, 'meta', response.meta);
                                imgFiles.changeFile(inputName3, fileIndex3, 'width', response.width);
                                imgFiles.changeFile(inputName3, fileIndex3, 'height', response.height);
                                imgFiles.changeFile(inputName3, fileIndex3, 'mime', response.mime);
                                imgFiles.changeFile(inputName3, fileIndex3, 'thumb', response.thumb);
                                imgFiles.changeFile(inputName3, fileIndex3, 'size', Math.round(response.size / 1024));
                            }
                            // only if there are no pending reuests we may continue		
                            sendMessageWait--;
                            if (sendMessageWait == 0) {
                                if (imgFiles.hasImages()) {
                                    showImages(imgFiles, true);
                                } else {
                                    doNormalSubmit();
                                }
                            }
                            return true;
                        };

                    })(file2, fileIndex2, inputName2)
                            );
                };

            })(file, fileIndex, inputName);

            reader.readAsDataURL(file);
        }
    });

    if (!hasFiles) {
        doNormalSubmit();
    }
};

function removeSubmitHandler(formHandler) {
    $(formHandler).off('submit');
    $(formHandler).unbind('submit');
}

function addSubmitHandler() {
    $.each($('form'), function(key, value) {
        // we want each form containing a file-input to use our submit handler 
        if ((!options.respectSupportInputField || $(value).find('input[name=supportPhotoMetadataPrivacy]').length || $(value).find('input[name=supportPhotoMetadataPrivacyMetadataService]').length) && $(value).find('input[type=file]').length) {
            removeSubmitHandler(value);
            $(value).on('submit', handleSubmit);
        }
    });
}

function doNormalSubmit() {
    removeSubmitHandler(form);
    $(form).submit();
}

function doSubmit() {
    $('#photoMetadataPrivacyOverlaySubmit').html(chrome.i18n.getMessage("uploading_wait"));

    // we have to disable the fields of the processed images, because formdata shall not copy them itself.
    for (var inputName in imgFiles.files) {
        if (imgFiles.files.hasOwnProperty(inputName)) {
            $(form).find('[name=' + escapeJQuerySelect(inputName) + ']').prop('disabled', true);
        }
    }

    // copy form to formdata
    var formData = new FormData(form);
    // add images manually
    for (var inputName in imgFiles.files) {
        if (imgFiles.files.hasOwnProperty(inputName)) {
            for (i = 0; i < imgFiles.files[inputName].length; i++) {
                formData.append(inputName, dataURItoBlob(imgFiles.files[inputName][i].fileData), imgFiles.files[inputName][i].name);
            }
        }
    }

    // send it all to the website
    var xhr = new XMLHttpRequest();
    xhr.open('POST', form.action);
    xhr.onload = function() {

        var newDoc = document.open("text/html", "replace");
        newDoc.onreadystatechange = function() {
            // if the new document is loaded, we have to initialize the extension again
            if (this.readyState == 'complete') {
                init();
            }
        };
        newDoc.write(xhr.responseText);
        newDoc.close();

    };
    xhr.onerror = function() {
        console.log(xhr);
    }
    xhr.send(formData);
}


// show metadata fpr a single image (called with context menu)
function showMeta(data) {
    showOverlay();
    if (!data.name) {
        data.name = data.url == "" ? 'n/a' : data.url.substr(data.url.lastIndexOf("/") + 1);
    }
    showImage($.extend({}, data, {
        "thumbID": 'photoMetadataPrivacyThumb',
        "contentID": 'photoMetadataPrivacyContent',
        "first": true,
        "upload": false
    }));
    activateTooltip(".photoMetadataPrivacyMetaDataTools a");
}

//handles the displaying of a metadatum
function handleNormal(tags, tagIndex, tag, image, metaTypeName, metaTagInfo) {
    var HTMLtmp = '';
    var data = {
        "key": tag.key,
        "inputName": image.inputName,
        "fileIndex": image.fileIndex,
        "metaTypeName": metaTypeName,
        "valueType": tag.valueType,
        "typeName": tag.typeName
    };
    if (image.imgFilesIndex) {
        data.imgFilesIndex = image.imgFilesIndex;
    }
    HTMLtmp = '<div class="photoMetadataPrivacyMetaDataEntry' + (metaTagInfo.important == 1 ? ' photoMetadataPrivacyMetaDataEntryImportant' : '') + '" data-data="' + JSON.stringify(data).replace(/"/g, '&quot;') + '">';

    HTMLtmp += '<h3>' + metaKeyToTitle(tag.key) + ' <div class="photoMetadataPrivacyMetaDataTools">';
    HTMLtmp += '<a class="photoMetadataPrivacyHelp" title="<b>Key</b>: ' + tag.key + '<div class=\'photoMetadataPrivacyTooltipSpacer\' /><b>Type</b>: ' + (tag.valueType != "" ? tag.valueType : tag.typeName) + '<div class=\'photoMetadataPrivacyTooltipSpacer\' /><b>Description</b>: ' + metaTagInfo.desc + '"><img src="' + chrome.runtime.getURL('images/help.png') + '" /></a> ';
    if (image.upload) {
        HTMLtmp += '<a class="photoMetadataPrivacyEdit" title="Click to edit this ' + metaTypeName + ' tag"><img src="' + chrome.runtime.getURL('images/edit.png') + '" /></a> ';
        HTMLtmp += '<a class="photoMetadataPrivacyDelete" title="Click to delete this ' + metaTypeName + ' tag"><img src="' + chrome.runtime.getURL('images/delete.png') + '" /></a>';
    }
    HTMLtmp += '</div></h3>';
    // if we have some special metadatum, e.g. array, we have to handle it seperatly
    if (tag.valueType == "xsStruct" && tag.typeName == "XmpText") {
        var ret = handleStruct(tags, tagIndex, tag, image, metaTypeName, metaTagInfo);
        HTMLtmp += ret.HTML;
        var tagsShift = ret.tagsShift;
    } else if (tag.valueType == "xaBag" && tag.typeName == "XmpText") {
        var ret = handleBag(tags, tagIndex, tag, image, metaTypeName, metaTagInfo);
        HTMLtmp += ret.HTML;
        var tagsShift = ret.tagsShift;
    } else if (tag.valueType == "xaAlt" && tag.typeName == "XmpText") {
        var ret = handleAlt(tags, tagIndex, tag, image, metaTypeName, metaTagInfo);
        HTMLtmp += ret.HTML;
        var tagsShift = ret.tagsShift;
    } else if (tag.valueType == "xaSeq" && tag.typeName == "XmpText") {
        var ret = handleSeq(tags, tagIndex, tag, image, metaTypeName, metaTagInfo);
        HTMLtmp += ret.HTML;
        var tagsShift = ret.tagsShift;
    } else {
        // an xmp array of string may be handled here. for editing it needs different input-fields
        if (metaTypeName == 'xmp') {
            if ((tag.valueType == 'xaSeq' && tag.typeName == "XmpSeq") || (tag.valueType == 'xaBag' && tag.typeName == "XmpBag") || (tag.valueType == 'xaAlt' && tag.typeName == "XmpAlt")) {
                var value = '';
                var editInputs = '';
                if (tag.value) {
                    for (i = 0; i < tag.value.length; i++) {
                        value += tag.value[i];
                        if (i != tag.value.length - 1) {
                            value += "; ";
                        }
                        editInputs += '<input type="text" name="' + i + '" value="' + tag.value[i].replace(/"/g, "&quot;") + '" />';
                    }
                }
            } else {
                value = tag.value;
                editInputs = '<input type="text" name="0" value="' + tag.value.replace(/"/g, "&quot;") + '" />';
            }
        } else {

            value = tag.value;
            editInputs = '<input type="text" name="0" value="' + tag.value.replace(/"/g, "&quot;") + '" />';
        }

        HTMLtmp += '<div class="photoMetadataPrivacyEditShow">' + value + '</div>';
        if (image.upload) {
            HTMLtmp += '<div class="photoMetadataPrivacyEditEdit" style="display:none;">' + editInputs;
            HTMLtmp += '<a class="photoMetadataPrivacyEditSave"><img src="' + chrome.runtime.getURL('images/save.png') + '" /></a></div> ';
        }
        tagsShift = 0;
        if ($.trim(value) == '' && !options.showEmptyMeta) {
            return {
                "HTML": "",
                "tagsShift": 0
            };
        }
    }

    HTMLtmp += '</div>';

    return {
        "HTML": HTMLtmp,
        "tagsShift": tagsShift
    };
}
// handles a structure. Returns the HTML to be inserted and a count of follwing tags belonging to this tag, that shall be skipped
// a structure contaisn metadata, but has no "own value" to be printed
function handleStruct(tags, tagIndex, tag, image, metaTypeName, metaTagInfo) {
    var HTMLtmp = '';
    var structCount = 0;
    var tagsShift = 0;
    while (
            ++structCount &&
            ++tagIndex &&
            tags[tagIndex] != undefined &&
            tags[tagIndex].key.substr(0, tag.key.length) == tag.key) {
        if (tagsShift > 0) {
            tagsShift--;
        } else {
            var ret = handleNormal(tags, tagIndex, tags[tagIndex], image, metaTypeName, metaTagInfo);
            HTMLtmp += ret.HTML;
            var tagsShift = ret.tagsShift;
        }
    }
    return {
        "HTML": HTMLtmp,
        "tagsShift": (structCount - 1) + tagsShift
    };
}
// handles a xmp bag array
//Returns the HTML to be inserted and a count of follwing tags belonging to this tag, that shall be skipped
// array entries are different metatags with index in keys for example: Xmp.MP.RegionInfo/MPRI:Regions[3] has index 3
function handleBag(tags, tagIndex, tag, image, metaTypeName, metaTagInfo) {
    var HTMLtmp = '';
    var bagCount = 0;
    var tagsShift = 0;
    pattern1 = new RegExp(escapeRegex(tag.key));
    pattern2 = new RegExp(escapeRegex(tag.key) + "\\[\\d+\\]");

    while (
            ++bagCount && ++tagIndex && tags[tagIndex] != undefined && tags[tagIndex].key.search(pattern1) == 0 && tags[tagIndex].key.search(pattern2) == 0) {
        if (tagsShift > 0) {
            tagsShift--;
        } else {
            var ret = handleNormal(tags, tagIndex, tags[tagIndex], image, metaTypeName, metaTagInfo);
            HTMLtmp += ret.HTML;
            tagsShift = ret.tagsShift;
        }
    }
    return {
        "HTML": HTMLtmp,
        "tagsShift": (bagCount - 1) + tagsShift
    };
}

// Handles xmp sequences. Equal to handleBag since the extesion handles all arrays as ordered arrays
function handleSeq(tags, tagIndex, tag, image, metaTypeName, metaTagInfo) {
    var HTMLtmp = '';
    var seqCount = 0;
    var tagsShift = 0;
    pattern1 = new RegExp(escapeRegex(tag.key));
    pattern2 = new RegExp(escapeRegex(tag.key) + "\\[\\d+\\]");

    while (
            ++seqCount && ++tagIndex && tags[tagIndex] != undefined && tags[tagIndex].key.search(pattern1) == 0 && tags[tagIndex].key.search(pattern2) == 0) {
        if (tagsShift > 0) {
            tagsShift--;
        } else {
            var ret = handleNormal(tags, tagIndex, tags[tagIndex], image, metaTypeName, metaTagInfo);
            HTMLtmp += ret.HTML;
            tagsShift = ret.tagsShift;
        }
    }
    return {
        "HTML": HTMLtmp,
        "tagsShift": (seqCount - 1) + tagsShift
    };
}
// Handles xmp alternatives. Equal to handleBag since the extesion handles all arrays as ordered arrays
function handleAlt(tags, tagIndex, tag, image, metaTypeName, metaTagInfo) {
    var HTMLtmp = '';
    var altCount = 0;
    var tagsShift = 0;
    pattern1 = new RegExp(escapeRegex(tag.key));
    pattern2 = new RegExp(escapeRegex(tag.key) + "\\[\\d+\\]");

    while (
            ++altCount && ++tagIndex && tags[tagIndex] != undefined && tags[tagIndex].key.search(pattern1) == 0 && tags[tagIndex].key.search(pattern2) == 0) {
        if (tagsShift > 0) {
            tagsShift--;
        } else {
            var ret = handleNormal(tags, tagIndex, tags[tagIndex], image, metaTypeName, metaTagInfo);
            HTMLtmp += ret.HTML;
            tagsShift = ret.tagsShift;
        }
    }
    return {
        "HTML": HTMLtmp,
        "tagsShift": (altCount - 1) + tagsShift
    };
}

// call a slide to left or right via buttons
function callThumbSlide(right) {
    currentIndex = $('.photoMetadataPrivacyThumbActive').index();
    if ((!right && currentIndex == 0) || (right && currentIndex == thumbs.length - 1)) {
        return;
    }
    nextIndex = currentIndex + (right ? 1 : -1);
    $($('#photoMetadataPrivacyThumbs .photoMetadataPrivacyThumb')[nextIndex]).click();
}


animation = false;
function removeOverlay(animation) {
    if (animation) {
        animation = false;
        $('#photoMetadataPrivacyOverlay').fadeOut('slow', function() {
            $('#photoMetadataPrivacyOverlay').remove();
        });
        $('#photoMetadataPrivacyContainer').fadeOut('fast', function() {
            $('#photoMetadataPrivacyContainer').remove();
        });
    } else {
        $('#photoMetadataPrivacyOverlay').remove();
        $('#photoMetadataPrivacyContainer').remove();
    }
}

function showOverlay(upload) {
    removeOverlay();
    $('html, body').animate({
        scrollTop: 0
    }, 'slow');
    // on uploads we dim the rest of the website
    if (upload) {
        $('body').append('<div id="photoMetadataPrivacyOverlay"></div>');
        $('#photoMetadataPrivacyOverlay').on('click', function(e) {
            if (e.target !== this) {
                return;
            }
            removeOverlay(true);
        });
    }
    $('body').append('<div id="photoMetadataPrivacyContainer" class="photoMetadataPrivacyScope"><div id="photoMetadataPrivacyThumbsUnderlay" />' +
            '<div id="photoMetadataPrivacyThumbsLoading" /><div id="photoMetadataPrivacyThumbs"></div><div id="photoMetadataPrivacyContents"></div>' +
            '<div style="clear:both;" />' +
            '  <div id="photoMetadataPrivacyConfirmUploadBothServices" title="Metadaten zu beiden Diensten hochladen?">' +
            '    <p>Klicken Sie auf &quot;Ja&quot;, um die Metadaten der Bilder zu beiden Diensten hochzuladen. Wenn Sie &quot;Nein&quot; wählen, werden Metadaten nur zum Metadaten-Service hochgeladen.</p>' +
            '  </div>' +
            '</div><div id="photoMetadataPrivacyContainer2" class="photoMetadataPrivacyScope" />');
    // resize gui with users settings
    $('#photoMetadataPrivacyContainer').width(options.GUIWidth);
    $('#photoMetadataPrivacyThumbsLoading').height(options.thumbsHeight);
    $('#photoMetadataPrivacyThumbsUnderlay').height(options.thumbsHeight);
    $('#photoMetadataPrivacyThumbs').height(options.thumbsHeight);


    $('<div id="photoMetadataPrivacyClose" title="Schlie&szlig;en">X</div>').click(function(e) {
        e.stopPropagation();
        e.preventDefault();
        removeOverlay(true);
    }).prependTo('#photoMetadataPrivacyContainer');

    $('#photoMetadataPrivacyThumbs').width(0);
}

// show an animation for image loading
function showLoading(upload) {
    showOverlay(upload);
    $('#photoMetadataPrivacyContainer').html('<div class="photoMetadataPrivacyLoading"><img src="' + chrome.runtime.getURL('images/loading.gif') + '" /></div>');
}

thumbs = [];
thumbsLoadWaiting = 0;
//show many images in sidebar, base on a ImgFiles object
function showImages(showFiles, upload, active) {
    thumbs = [];
    thumbsLoadWaiting = 0;
    if (active == null)
        active = 0;
    showOverlay(upload);
    var counter = 0;
    var hasActive = false;
    for (var inputName in showFiles.files) {
        if (showFiles.files.hasOwnProperty(inputName)) {
            for (fileIndex = 0; fileIndex < showFiles.files[inputName].length; fileIndex++) {
                if (!showFiles.files[inputName][fileIndex].deleted) {
                    var isActive = counter == active;
                    if (isActive) {
                        hasActive = true;
                    }
                    thumbsLoadWaiting++;
                    $('#photoMetadataPrivacyThumbsLoading').show();
                    showImage($.extend({}, showFiles.files[inputName][fileIndex], {
                        "thumbID": 'photoMetadataPrivacyThumb' + inputName + "" + fileIndex,
                        "contentID": 'photoMetadataPrivacyContent' + inputName + "" + fileIndex,
                        "first": isActive,
                        "upload": upload,
                        "inputName": inputName,
                        "fileIndex": fileIndex,
                        "imgFilesIndex": counter
                    }));
                }
                counter++;
            }
        }
    }
    activateTooltip(".photoMetadataPrivacyMetaDataTools a");
    if (upload) {
        $('#photoMetadataPrivacyThumbs').after('<div id="photoMetadataPrivacyOverlaySubmit"><button id="photoMetadataPrivacySubmit">'+chrome.i18n.getMessage("btn_continue_upl")+'</button></div>');
        $('#photoMetadataPrivacySubmit').button().on('click', function() {
            doSubmit();
        });
    }
    $('#photoMetadataPrivacyContainer').prepend('<div class="photoMetadataPrivacyLeftButton" /><div class="photoMetadataPrivacyRightButton" />');
    // place the navigation buttons for the thumb-slideshow based on users settings for thumbs height
    var top;
    if (options.thumbsHeight <= 56) {
        top = 0;
    } else {
        top = Math.round((options.thumbsHeight - 56) / 2);
    }
    $('.photoMetadataPrivacyLeftButton, .photoMetadataPrivacyRightButton').css('top', top + 'px');
      $('.photoMetadataPrivacyLeftButton').click(function() {
        callThumbSlide(0);
    });
    $('.photoMetadataPrivacyRightButton').click(function() {
        callThumbSlide(1);
    });


    if (!hasActive) {
        $('.photoMetadataPrivacyThumb').first().click();
    }

}

function showImage(image) {
    //insert the thumb. 
    var HTML = '<div id="' + image.thumbID + '" class="photoMetadataPrivacyThumb' + (image.first ? ' photoMetadataPrivacyThumbActive' : '') +
            '"><div class="photoMetadataPrivacyThumbInactive" ' + (image.first ? 'style="display:none;"' : 'style="display:block;"') + '></div>';
    HTML += '<span>' + image.name + '</span><img src="' + (image.displayUrl ? image.displayUrl : image.fileData) + '" /></div>';
    $('#photoMetadataPrivacyThumbs').append(HTML);
    $(escapeJQuerySelect('#' + image.thumbID) + ' img').height(options.thumbsHeight);

    // a click on a thumb navigates the slideshow to it and activates the related image in the gui
    $(escapeJQuerySelect('#' + image.thumbID)).click(
            (function(contentID, thumbID) {
                return function(evt) {
                    $('.photoMetadataPrivacyThumbActive').removeClass('photoMetadataPrivacyThumbActive');
                    $('.photoMetadataPrivacyThumb .photoMetadataPrivacyThumbInactive').show();
                    $('.photoMetadataPrivacyContent').hide();
                    $(escapeJQuerySelect('#' + contentID)).show();
                    $(escapeJQuerySelect('#' + thumbID) + ' .photoMetadataPrivacyThumbInactive').hide();
                    $(escapeJQuerySelect('#' + thumbID)).addClass('photoMetadataPrivacyThumbActive');
                    var index = $(this).index();
                    var containerWidth = $('#photoMetadataPrivacyContainer').width();
                    var slideWidth = $('#photoMetadataPrivacyThumbs').width();
                    widthSum = 0;
                    for (i = 0; i <= index; i++) {
                        if (i < index) {
                            widthSum += thumbs[i];
                        } else {
                            widthSum += Math.round(thumbs[i] / 2);
                        }
                    }
                    var slideMargin = 0;
                    if (widthSum > Math.round(containerWidth / 2)) {
                        if (widthSum > (slideWidth - Math.round(containerWidth / 2))) {
                            slideMargin = -(slideWidth - containerWidth);
                        } else {
                            slideMargin = -(widthSum - Math.round(containerWidth / 2));
                        }
                    } else {
                        slideMargin = 0;
                    }
                    $('#photoMetadataPrivacyThumbs').animate({
                        'marginLeft': slideMargin
                    });
                    if (index == 0) {
                        $('.photoMetadataPrivacyLeftButton').hide();
                    } else {
                        $('.photoMetadataPrivacyLeftButton').show();
                    }
                    if (index == thumbs.length - 1) {
                        $('.photoMetadataPrivacyRightButton').hide();
                    } else {
                        $('.photoMetadataPrivacyRightButton').show();
                    }

                };

            })(image.contentID, image.thumbID)
            );
    // width and height of a thumb can be determined after it has been loaded
    $(escapeJQuerySelect('#' + image.thumbID) + ' img').load((function(contentID, thumbID) {
        return function(evt) {
            width = $(this).width();
            $(this).parent().children('.photoMetadataPrivacyThumbInactive').width(width);
            $(this).parent().children('span').width(width - 10);
            var thumbsWidth = $('#photoMetadataPrivacyThumbs').width() + width;
            thumbs[$(this).parent().index()] = width;
            $('#photoMetadataPrivacyThumbs').width(thumbsWidth);
            index = $('.photoMetadataPrivacyThumbActive').index();
            thumbsLoadWaiting--;
            if (thumbsLoadWaiting <= 0) {
                // if all thumbs are loaded the slideshow can navigate to the active one
                $('#photoMetadataPrivacyThumbsLoading').hide();
                $($('#photoMetadataPrivacyThumbs .photoMetadataPrivacyThumb')[index]).click();
            }
        };

    })(image.contentID, image.thumbID)
            );
    HTML = '';
    // build groups and containers for metadata
    HTML += '<div id="' + image.contentID + '" class="photoMetadataPrivacyContent" ' + (image.first ? 'style="display:block;"' : 'style="display:none;"') +
            ' data-data="' + JSON.stringify({
        "inputName": image.inputName,
        "fileIndex": image.fileIndex,
        "imgFilesIndex": image.imgFilesIndex
    }).replace(/"/g, '&quot;') + '">';

    HTML += '<h1>' + image.name + ' <span>';

    HTML += image.width + 'x' + image.height + ' Pixel | ';
    HTML += image.mime;
    HTML += ' | ' + image.size + ' kByte';

    if (image.upload) {
        HTML += ' | ' + '<button class="photoMetadataPrivacyDeleteAllMeta">'+chrome.i18n.getMessage("btn_delete_all")+'</button>';
    }

    HTML += '</span></h1>';
    if (!image.flickrMeta) {
        HTML += '<div class="photoMetadataPrivacyDataGroup-1 photoMetadataPrivacyDataGroup"><h1>'+chrome.i18n.getMessage("group_people")+'<span></span></h1></div>';
    }
    if (!image.flickrMeta || image.lat) {
        HTML += '<div class="photoMetadataPrivacyDataGroup-2 photoMetadataPrivacyDataGroup"><h1>'+chrome.i18n.getMessage("group_location")+'<span></span></h1></div>';
    }
    if (!image.flickrMeta) {
        HTML += '<div class="photoMetadataPrivacyDataGroup-3 photoMetadataPrivacyDataGroup"><h1>'+chrome.i18n.getMessage("group_datetime")+'<span></span></h1></div>';
        HTML += '<div class="photoMetadataPrivacyDataGroup-4 photoMetadataPrivacyDataGroup"><h1>'+chrome.i18n.getMessage("group_content")+'<span></span></h1></div>';
    }
    if (image.flickrMeta) {
        HTML += '<div class="photoMetadataPrivacyDataGroup-5 photoMetadataPrivacyDataGroup"><h1>'+chrome.i18n.getMessage("group_flickr")+'<span></span></h1></div>';
    }

    if (image.thumb) {
        HTML += '<div class="photoMetadataPrivacyDataExifThumb photoMetadataPrivacyDataGroup"><h1>'+chrome.i18n.getMessage("group_preview")+'</h1>';

        if (image.upload) {
            HTML += '<div class="photoMetadataPrivacyMetaDataTools">';
            HTML += '<a class="photoMetadataPrivacyThumbDelete" title="Click to delete the thumb"><img src="' + chrome.runtime.getURL('images/delete.png') + '" /></a>';
            HTML += '</div>';
        }

        HTML += '<img src="' + image.thumb + '" alt="Bild Thumb" /></div>';
    }

    HTML += '<table class="photoMetadataPrivacyMetaData" style="display:none;"><tr><th class="photoMetadataPrivacyMetaDataHeadEXIF">EXIF (<span>' + objLength(image.meta.exif) + '</span>)</th><th class="photoMetadataPrivacyMetaDataHeadXMP">XMP (<span>' + objLength(image.meta.xmp) + '</span>)</th><th class="photoMetadataPrivacyMetaDataHeadIPTC">IPTC (<span>' + objLength(image.meta.iptc) + '</span>)</th></tr>';
    HTML += '<tr><td class="photoMetadataPrivacyMetaDataEXIF"></td><td class="photoMetadataPrivacyMetaDataXMP"></td><td class="photoMetadataPrivacyMetaDataIPTC"></td></tr></table>';
    HTML += '</div>';
    $('#photoMetadataPrivacyContents').append(HTML);

    // check if there are person tags and display bounding boxes over thumbs
    if (objLength(personTags = getPersonTags(image.meta, image)) > 0) {

        var personImportant = metaTagsInfo["Xmp.mwg-rs.Regions"].important && typeof personTags.mwg != "undefined" || metaTagsInfo["Xmp.MP.RegionInfo"].important && typeof personTags.mp != "undefined";

        HTML = '<div class="photoMetadataPrivacyPT ' + (personImportant ? "photoMetadataPrivacyMetaDataEntryImportant" : '') + '"><div class="photoMetadataPrivacyPTEntries" /><div class="photoMetadataPrivacyPTSpacer" /><div class="photoMetadataPrivacyPTNames" /></div>';
        $(escapeJQuerySelect('#' + image.contentID) + ' .photoMetadataPrivacyDataGroup-1').prepend(HTML);

        var setPT = (function(thumbID, contentID) {
            return function(ptStandard, pts) {
                thumbW = $(escapeJQuerySelect('#' + thumbID) + '').width();
                thumbH = $(escapeJQuerySelect('#' + thumbID) + '').height();
                $(escapeJQuerySelect('#' + thumbID)).find('.photoMetadataPrivacyBB').remove();
                for (var index = 0, pt; pt = pts[index]; index++) {

                    var borderRadius = 0;
                    if (ptStandard == 'mwg') {
                        var x = Math.round(thumbW * pt.x);
                        var y = Math.round(thumbH * pt.y);
                        if (pt.type == 'rec') {
                            var h = Math.round(thumbH * pt.h);
                            var w = Math.round(thumbW * pt.w);
                            var top = Math.round(y - (h / 2));
                            var left = Math.round(x - (w / 2));
                        } else if (pt.type == 'cir') {
                            var h = Math.round(Math.min(thumbH, thumbW) * pt.d);
                            var w = Math.round(Math.min(thumbH, thumbW) * pt.d);
                            var top = Math.round(y - (h / 2));
                            var left = Math.round(x - (w / 2));
                            var borderRadius = Math.round(h / 2);
                        } else {
                            var h = Math.round(thumbH * 0.04);
                            var w = Math.round(thumbW * 0.04);
                            var top = Math.round(y - (h / 2));
                            var left = Math.round(x - (w / 2));
                        }
                    } else if (ptStandard == 'mp') {
                        var h = Math.round(thumbH * pt.h);
                        var w = Math.round(thumbW * pt.w);
                        var top = Math.round(thumbH * pt.top);
                        var left = Math.round(thumbW * pt.left);
                    }
                    $('<div class="photoMetadataPrivacyBB" title="' + pt.name + '" />')
                            .css({
                        'top': top + 'px',
                        'left': left + 'px',
                        'width': w + 'px',
                        'height': h + 'px',
                        'border-radius': borderRadius + 'px'
                    })
                            .prependTo(escapeJQuerySelect('#' + thumbID));
                }
                $(escapeJQuerySelect('#' + contentID) + ' .photoMetadataPrivacyPTName').hide();
                $(escapeJQuerySelect('#' + contentID) + ' .photoMetadataPrivacyPTName' + ptStandard).show();
                activateTooltip(".photoMetadataPrivacyBB");
            };

        })(image.thumbID, image.contentID);


        first = true;
        var firstPTStandard = false;
        var firstPTStandardPTS = false;
        // person tags may be provided in different schemata. display one at time
        var countPersonTags = objLength(personTags);
        var count = 0;
        for (var ptStandard in personTags) {
            if (!firstPTStandard) {
                firstPTStandard = ptStandard
                firstPTStandardPTS = personTags[ptStandard];
            }
            $('<div class="photoMetadataPrivacyPTEntry' + (first ? ' photoMetadataPrivacyPTEntryActive' : '') + '"></div>')
                    .html(' '+chrome.i18n.getMessage("ui_persontags")+' '/*+ptStandard.toUpperCase()*/ + (countPersonTags > 1 ? ++count : ''))
                    .click((function(ptStandard, pts, setPT) {
                return function() {
                    $(this).parents('.photoMetadataPrivacyPTEntries').children('.photoMetadataPrivacyPTEntry').removeClass('photoMetadataPrivacyPTEntryActive');
                    if ($(this).hasClass('photoMetadataPrivacyPTEntry')) {
                        $(this).addClass('photoMetadataPrivacyPTEntryActive');
                    } else {
                        $(this).parents('.photoMetadataPrivacyPTEntry').addClass('photoMetadataPrivacyPTEntryActive');
                    }
                    setPT(ptStandard, pts);
                };

            })(ptStandard, personTags[ptStandard], setPT))
                    .appendTo(escapeJQuerySelect('#' + image.contentID) + ' .photoMetadataPrivacyDataGroup-1 .photoMetadataPrivacyPT .photoMetadataPrivacyPTEntries');

            namesHTML = '';
            for (var index = 0, pt; pt = personTags[ptStandard][index]; index++) {
                namesHTML += '<b>Name:</b> ' + pt.name + '';
                if (index < personTags[ptStandard].length - 1) {
                    namesHTML += '<br />';
                }
            }
            $('<div class="photoMetadataPrivacyPTName photoMetadataPrivacyPTName' + ptStandard + '" style="display:none;"></div>')
                    .html(namesHTML)
                    .appendTo(escapeJQuerySelect('#' + image.contentID) + ' .photoMetadataPrivacyDataGroup-1 .photoMetadataPrivacyPT .photoMetadataPrivacyPTNames');

            first = false;
        }

        $(escapeJQuerySelect('#' + image.thumbID) + ' img').one('load', (function(firstPTStandard, firstPTStandardPTS) {
            return function() {
                setPT(firstPTStandard, firstPTStandardPTS);
            };

        })(firstPTStandard, firstPTStandardPTS))
                .each(function() {
            if (this.complete)
                $(this).load();
        });

        if (!image.upload) {
            if (metaTagsInfo["Xmp.mwg-rs.Regions"].important) {
                image.meta = ignoreMetaData("Xmp.mwg-rs.Regions", image.meta);
            }

            if (metaTagsInfo["Xmp.MP.RegionInfo"].important) {
                image.meta = ignoreMetaData("Xmp.MP.RegionInfo", image.meta);
            }
        }
    }

    // get geolocations to display them in the map
    // the map can only be render if visible!
    if ((geoLocations = getGeolocations(image.meta, image)).length > 0) {
        if ($('head').length == 0) {
            $('<head />').prependTo('html');
        }
        var geoImportant =
                (metaTagsInfo["Exif.GPSInfo.GPSLatitude"].important || metaTagsInfo["Exif.GPSInfo.GPSLatitudeRef"].important ||
                        metaTagsInfo["Exif.GPSInfo.GPSLongitudeRef"].important || metaTagsInfo["Exif.GPSInfo.GPSLongitude"].important)
                && (geoLocations[0] && geoLocations[0].metaTypeName == "exif" || geoLocations[1] && geoLocations[1].metaTypeName == "exif") ||
                (metaTagsInfo["Xmp.exif.GPSLongitude"].important || metaTagsInfo["Xmp.exif.GPSLatitude"].important)
                && (geoLocations[0] && geoLocations[0].metaTypeName == "xmp" || geoLocations[1] && geoLocations[1].metaTypeName == "xmp" || geoLocations[2] && geoLocations[2].metaTypeName == "xmp");


        HTML = '<div class="photoMetadataPrivacyGEO ' + (geoImportant ? "photoMetadataPrivacyMetaDataEntryImportant" : '') + '"><div class="photoMetadataPrivacyGEOEntries" /><div class="photoMetadataPrivacyGEOMapSpacer" /></div>';
        $(escapeJQuerySelect('#' + image.contentID) + ' .photoMetadataPrivacyDataGroup-2').prepend(HTML);

        //this function renders the map. get gets atached to click events.
        setGEO = (function(id) {
            return function(geo) {
                $(escapeJQuerySelect('#' + image.contentID) + ' .photoMetadataPrivacyDataGroup-2 .photoMetadataPrivacyGEOMap').remove()
                $(escapeJQuerySelect('#' + image.contentID) + ' .photoMetadataPrivacyDataGroup-2 .photoMetadataPrivacyGEO')
                        .append('<div class="photoMetadataPrivacyGEOMap" id="' + image.contentID + 'GEOMap" />');

                OpenLayers.ImgPath = chrome.runtime.getURL("openlayers/img/");
                map = new OpenLayers.Map(id, {
                    theme: chrome.runtime.getURL("openlayers/theme/default/style.css")
                });
                var mapnik = new OpenLayers.Layer.OSM();
                var fromProjection = new OpenLayers.Projection("EPSG:4326");   // Transform from WGS 1984
                var toProjection = new OpenLayers.Projection("EPSG:900913"); // to Spherical Mercator Projection
                var position = new OpenLayers.LonLat(geo.lng, geo.lat).transform(fromProjection, toProjection);
                var zoom = 14;

                map.addLayer(mapnik);
                map.setCenter(position, zoom);

                var markers = new OpenLayers.Layer.Markers("Markers");
                markers.addMarker(new OpenLayers.Marker(position));
                map.addLayer(markers);
            };

        })(image.contentID + 'GEOMap');

        for (var index = 0, geo; geo = geoLocations[index]; index++) {
            $('<div class="photoMetadataPrivacyGEOEntry' + (index == 0 ? ' photoMetadataPrivacyGEOEntryActive' : '') + '"><b>' + geo.metaTypeName.toUpperCase() + '</b><br />Lat: ' + (Math.round(geo.lat * 100000) / 100000) + '<br/>Lng: ' + (Math.round(geo.lng * 100000) / 100000) + '</div>')
                    .click((function(geo, setGEO) {
                return function() {
                    $(this).parents('.photoMetadataPrivacyGEOEntries').children('.photoMetadataPrivacyGEOEntry').removeClass('photoMetadataPrivacyGEOEntryActive');
                    if ($(this).hasClass('photoMetadataPrivacyGEOEntry')) {
                        $(this).addClass('photoMetadataPrivacyGEOEntryActive');
                    } else {
                        $(this).parents('.photoMetadataPrivacyGEOEntry').addClass('photoMetadataPrivacyGEOEntryActive');
                    }
                    setGEO(geo);
                };

            })(geo, setGEO))
                    .appendTo(escapeJQuerySelect('#' + image.contentID) + ' .photoMetadataPrivacyDataGroup-2 .photoMetadataPrivacyGEO .photoMetadataPrivacyGEOEntries');
        }
        // for the active image, render map now
        if (image.first) {
            setGEO(geoLocations[0]);
        }
        // other maps get rendered if the related image gets activated
        $(escapeJQuerySelect('#' + image.thumbID)).click(
                (function(setGEO, geo) {
                    return function(evt) {
                        setGEO(geo);
                    };

                })(setGEO, geoLocations[0])
                );

        if (!image.upload) {
            if (metaTagsInfo["Exif.GPSInfo.GPSLatitude"].important) {
                image.meta = ignoreMetaData("Exif.GPSInfo.GPSLatitude", image.meta);
            }
            if (metaTagsInfo["Exif.GPSInfo.GPSLatitudeRef"].important) {
                image.meta = ignoreMetaData("Exif.GPSInfo.GPSLatitudeRef", image.meta);
            }
            if (metaTagsInfo["Exif.GPSInfo.GPSLongitudeRef"].important) {
                image.meta = ignoreMetaData("Exif.GPSInfo.GPSLongitudeRef", image.meta);
            }
            if (metaTagsInfo["Exif.GPSInfo.GPSLongitude"].important) {
                image.meta = ignoreMetaData("Exif.GPSInfo.GPSLongitude", image.meta);
            }
            if (metaTagsInfo["Xmp.exif.GPSLatitude"].important) {
                image.meta = ignoreMetaData("Xmp.exif.GPSLatitude", image.meta);
            }
            if (metaTagsInfo["Xmp.exif.GPSLongitude"].important) {
                image.meta = ignoreMetaData("Xmp.exif.GPSLongitude", image.meta);
            }
        }
    }
    // handle all metatags
    jQuery.each(image.meta, function(metaTypeName, tags) {
        if (tags != null) {
            tags = objToArray(tags);
            for (var tagIndex = 0, tag; tag = tags[tagIndex]; tagIndex++) {
                // if metadatum is not in the "extra metadata" area, decrease the count in that area
                if (metaTagsInfo[tag.key] == undefined || metaTagsInfo[tag.key].group != 0) {
                    count = parseInt($(escapeJQuerySelect('#' + image.contentID) + ' .photoMetadataPrivacyMetaDataHead' + metaTypeName.toUpperCase() + ' span').html());
                    $(escapeJQuerySelect('#' + image.contentID) + ' .photoMetadataPrivacyMetaDataHead' + metaTypeName.toUpperCase() + ' span').html((count - 1));
                }

                if (metaTagsInfo[tag.key] == undefined) {
                    continue;
                }

                if (metaTagsInfo[tag.key].group < 0) {
                    //ignore
                    continue;
                }

                if (tag.ignore) {
                    //ignore
                    continue;
                }

                subContentMetaTagID = image.contentID + tag.key;
                var HTML = '';

                // get the html for that metadatum
                var ret = handleNormal(tags, tagIndex, tag, image, metaTypeName, metaTagsInfo[tag.key]);

                HTML += ret.HTML;

                var tagsShift = ret.tagsShift;
                // shift the index for following tags may belong to this one (e.g. array), shift of 0 means normal string metadatum
                tagIndex += tagsShift;

                var insertFkt;
                if (metaTagsInfo[tag.key].important == 1) {
                    insertFkt = 'prepend';
                } else {
                    insertFkt = 'append';
                }

                if (metaTagsInfo[tag.key].group > 0) {
                    //insert into group 
                    if (insertFkt == 'append') {
                        $(escapeJQuerySelect('#' + image.contentID) + ' .photoMetadataPrivacyDataGroup-' + metaTagsInfo[tag.key].group)[insertFkt](HTML);
                    } else {
                        $(escapeJQuerySelect('#' + image.contentID) + ' .photoMetadataPrivacyDataGroup-' + metaTagsInfo[tag.key].group + " h1").after(HTML);
                    }
                } else {
                    // or insert into "extra"
                    $(escapeJQuerySelect('#' + image.contentID) + ' .photoMetadataPrivacyMetaData' + metaTypeName.toUpperCase())[insertFkt](HTML);
                    // if we have metadata here, activate the "show extra" button, if it does not already exist
                    if ($(escapeJQuerySelect('#' + image.contentID) + ' .photoMetadataPrivacyMetaDataToggle').length == 0) {
                        $(escapeJQuerySelect('#' + image.contentID) + ' .photoMetadataPrivacyMetaData').before('<button class="photoMetadataPrivacyMetaDataToggle">'+chrome.i18n.getMessage("btn_details1")+' <span>'+chrome.i18n.getMessage("btn_details2")+'</span><span style="display:none;">'+chrome.i18n.getMessage("btn_details2b")+'</span> '+chrome.i18n.getMessage("btn_details3")+'</button>');
                        $(escapeJQuerySelect('#' + image.contentID) + ' .photoMetadataPrivacyMetaDataToggle').button().unbind('click').click(function(evt) {
                            $(this).find('span span').toggle();
                            $(this).next().toggle();
                        });
                    }
                }
            }
        }
    });
    // flickr metadata get isnerted into flickr group.
    if (image.flickrMeta) {
        for (var tagIndex = 0, tag; tag = image.flickrMeta[tagIndex]; tagIndex++) {
            var value = tag.clean ? tag.clean._content : tag.raw._content;
            var HTML = '<div class="photoMetadataPrivacyMetaDataEntry"><h3>' + tag.label + '</h3>';
            HTML += '<div class="photoMetadataPrivacyEditShow">' + value + '</div>';
            HTML += '</div>';
            $(escapeJQuerySelect('#' + image.contentID) + ' .photoMetadataPrivacyDataGroup-5').append(HTML);
        }
    }

    //delete ALL metatag
    $(escapeJQuerySelect('#' + image.contentID) + ' .photoMetadataPrivacyDeleteAllMeta').click(
            function(evt) {
                var data = $(this).parents('.photoMetadataPrivacyContent').data('data');
                chrome.runtime.sendMessage({
                    task: "deleteAllMeta",
                    fileData: imgFiles.files[data.inputName][data.fileIndex].fileData
                },
                (function(data) {
                    return function(response) {
                        //save the meta data
                        imgFiles.changeFile(data.inputName, data.fileIndex, 'fileData', response.fileData);
                        imgFiles.changeFile(data.inputName, data.fileIndex, 'meta', response.meta);
                        imgFiles.changeFile(data.inputName, data.fileIndex, 'thumb', response.thumb);
                        imgFiles.changeFile(data.inputName, data.fileIndex, 'size', Math.round(response.size / 1024));
                        showImages(imgFiles, true, data.imgFilesIndex);
                        return true;
                    };

                })(data));
                showLoading();
            }
    );

    //delete a metatag
    $(escapeJQuerySelect('#' + image.contentID) + ' .photoMetadataPrivacyDelete').click(
            function(evt) {
                var data = $(this).parent().parent().parent().data('data');
                //sends delete request to nacl-module for each delete!
                chrome.runtime.sendMessage({
                    task: "deleteMeta",
                    "metaTypeName": data.metaTypeName,
                    "key": data.key,
                    "valueType": data.valueType,
                    "typeName": data.typeName,
                    fileData: imgFiles.files[data.inputName][data.fileIndex].fileData
                },
                (function(data) {
                    return function(response) {
                        //save the meta data
                        imgFiles.changeFile(data.inputName, data.fileIndex, 'fileData', response.fileData);
                        imgFiles.changeFile(data.inputName, data.fileIndex, 'meta', response.meta);
                        imgFiles.changeFile(data.inputName, data.fileIndex, 'size', Math.round(response.size / 1024));
                        showImages(imgFiles, true, data.imgFilesIndex);
                        return true;
                    };

                })(data));
                showLoading();
            }
    );

    //delete a exif thumb
    $(escapeJQuerySelect('#' + image.contentID) + ' .photoMetadataPrivacyThumbDelete').click(
            function(evt) {
                var data = $(this).parents('.photoMetadataPrivacyContent').data('data');
                //sends delete request to nacl-module for each delete!
                chrome.runtime.sendMessage({
                    task: "deleteThumb",
                    "metaTypeName": data.metaTypeName,
                    "key": data.key,
                    fileData: imgFiles.files[data.inputName][data.fileIndex].fileData
                },
                (function(data) {
                    return function(response) {
                        //save the meta data
                        imgFiles.changeFile(data.inputName, data.fileIndex, 'fileData', response.fileData);
                        imgFiles.changeFile(data.inputName, data.fileIndex, 'meta', response.meta);
                        imgFiles.changeFile(data.inputName, data.fileIndex, 'thumb', response.thumb);
                        imgFiles.changeFile(data.inputName, data.fileIndex, 'size', Math.round(response.size / 1024));
                        showImages(imgFiles, true, data.imgFilesIndex);
                        return true;
                    };

                })(data));
                showLoading();
            }
    );


    //show input to edit a metatag
    $(escapeJQuerySelect('#' + image.contentID) + ' .photoMetadataPrivacyEdit').click(
            function(evt) {
                $(".photoMetadataPrivacyEditEdit").hide();
                $(".photoMetadataPrivacyEditShow").show();
                $(this).parent().parent().parent().find(".photoMetadataPrivacyEditShow").toggle();
                $(this).parent().parent().parent().find(".photoMetadataPrivacyEditEdit").toggle();
            }
    );
    //edit a metatag
    $(escapeJQuerySelect('#' + image.contentID) + ' .photoMetadataPrivacyEditSave').click(
            function(evt) {
                var data = $(this).parent().parent().data('data');
                value = [];
                $(this).parent().children("input").each(function(key, input) {
                    value[key] = $(input).val().replace(/&quot;/g, "\"");
                });                
                //each edit request gets send to nacl-module
                chrome.runtime.sendMessage({
                    task: "editMeta",
                    "value": value,
                    "valueType": data.valueType,
                    "typeName": data.typeName,
                    "metaTypeName": data.metaTypeName,
                    "key": data.key,
                    fileData: imgFiles.files[data.inputName][data.fileIndex].fileData
                },
                (function(data) {
                    return function(response) {
                        //save the meta data
                        imgFiles.changeFile(data.inputName, data.fileIndex, 'fileData', response.fileData);
                        imgFiles.changeFile(data.inputName, data.fileIndex, 'meta', response.meta);
                        imgFiles.changeFile(data.inputName, data.fileIndex, 'size', Math.round(response.size / 1024));
                        showImages(imgFiles, true, data.imgFilesIndex);
                        return true;
                    };

                })(data));
                showLoading();
            }
    );
    //we want the Enter-Key to save changes too
    $(".photoMetadataPrivacyEditEdit > input").keypress(
            function(evt) {
                if (evt.which == 13) {
                    $(this).parent().children('.photoMetadataPrivacyEditSave').click();
                }
            }
    );
}

function getPersonTags(meta, image, remove) {
    var ret = {};
    if (meta.xmp != null) {
        tags = objToArray(meta.xmp);
        var counter = 0;
        // get all person tags in mwg-rs schema
        while (++counter && findMetaDatum(tags, "key", "Xmp.mwg-rs.Regions/mwg-rs:RegionList[" + counter + "]")) {
            x = NaN;
            y = NaN;
            w = NaN;
            h = NaN;
            d = NaN;
            if (tmp = findMetaDatum(tags, "key", "Xmp.mwg-rs.Regions/mwg-rs:RegionList[" + counter + "]/mwg-rs:Area/stArea:x")) {
                x = parseFloat(tmp.value);
            }
            if (tmp = findMetaDatum(tags, "key", "Xmp.mwg-rs.Regions/mwg-rs:RegionList[" + counter + "]/mwg-rs:Area/stArea:y")) {
                y = parseFloat(tmp.value);
            }
            if (tmp = findMetaDatum(tags, "key", "Xmp.mwg-rs.Regions/mwg-rs:RegionList[" + counter + "]/mwg-rs:Area/stArea:w")) {
                w = parseFloat(tmp.value);
            }
            if (tmp = findMetaDatum(tags, "key", "Xmp.mwg-rs.Regions/mwg-rs:RegionList[" + counter + "]/mwg-rs:Area/stArea:h")) {
                h = parseFloat(tmp.value);
            }
            if (tmp = findMetaDatum(tags, "key", "Xmp.mwg-rs.Regions/mwg-rs:RegionList[" + counter + "]/mwg-rs:Area/stArea:d")) {
                d = parseFloat(tmp.value);
            }

            name = '';
            if (tmp = findMetaDatum(tags, "key", "Xmp.mwg-rs.Regions/mwg-rs:RegionList[" + counter + "]/mwg-rs:Name")) {
                name = tmp.value;
            }
            if (name == '' && (tmp = findMetaDatum(tags, "key", "Xmp.mwg-rs.Regions/mwg-rs:RegionList[" + counter + "]/mwg-rs:Description"))) {
                name = tmp.value;
            }
            // area is required
            if (!isNaN(x) && x >= 0 && !isNaN(y) && y >= 0) {
                if (!isNaN(w) && w >= 0 && !isNaN(h) && h >= 0) {//rectangle
                    if (!ret.mwg)
                        ret.mwg = [];
                    ret.mwg.push({
                        type: 'rec',
                        name: name,
                        x: x,
                        y: y,
                        h: h,
                        w: w
                    });
                } else if (!isNaN(d) && d >= 0) {//circle
                    if (!ret.mwg)
                        ret.mwg = [];
                    ret.mwg.push({
                        type: 'cir',
                        name: name,
                        x: x,
                        y: y,
                        d: d
                    });
                } else {//point  
                    if (!ret.mwg)
                        ret.mwg = [];
                    ret.mwg.push({
                        type: 'poi',
                        name: name,
                        x: x,
                        y: y
                    });
                }
            }
        }

        var counter = 0;
        while (++counter && findMetaDatum(tags, "key", "Xmp.MP.RegionInfo/MPRI:Regions[" + counter + "]")) {
            x = NaN;
            y = NaN;
            w = NaN;
            h = NaN;
            d = NaN;
            var rec = false;
            if (tmp = findMetaDatum(tags, "key", "Xmp.MP.RegionInfo/MPRI:Regions[" + counter + "]/MPReg:Rectangle")) {
                rec = tmp.value.split(", ");
                var left = rec[0];
                var top = rec[1];
                var w = rec[2];
                var h = rec[3];
            }
            if (tmp = findMetaDatum(tags, "key", "Xmp.MP.RegionInfo/MPRI:Regions[" + counter + "]/MPReg:PersonDisplayName")) {
                var name = tmp.value;
            } else {
                //name is required in MPReg
                continue;
            }

            if (rec) {
                if (!ret.mp)
                    ret.mp = [];
                ret.mp.push({
                    type: 'rec',
                    name: name,
                    top: top,
                    left: left,
                    h: h,
                    w: w
                });
            } else {
                if (!ret.mp)
                    ret.mp = [];
                ret.mp.push({
                    type: 'any',
                    name: name
                });
            }
        }
    }
    return ret;
}

function getGeolocations(meta, image) {
    var ret = [];
    if (image.lat) {
        ret.push({
            lat: image.lat,
            lng: image.lng,
            metaTypeName: "Flickr API"
        });
    }
    for (var metaTypeName in meta) {
        var tags = meta[metaTypeName];
        if (tags == null)
            continue;
        tags = objToArray(tags);
        var lat, lng, latref, lngref, tmp, value;
        switch (metaTypeName) {
            case "exif":
                if (!(tmp = findMetaDatum(tags, "key", "Exif.GPSInfo.GPSLatitudeRef")))
                    continue;
                latref = tmp.value == "N" ? 1 : -1;
                if (!(tmp = findMetaDatum(tags, "key", "Exif.GPSInfo.GPSLongitudeRef")))
                    continue;
                lngref = tmp.value == "E" ? 1 : -1;

                if (!(tmp = findMetaDatum(tags, "key", "Exif.GPSInfo.GPSLatitude")))
                    continue;
                value = tmp.value.split(" ");
                lat = latref * (eval(value[0]) + eval(value[1]) / 60 + eval(value[2]) / 3600);

                if (!(tmp = findMetaDatum(tags, "key", "Exif.GPSInfo.GPSLongitude")))
                    continue;
                value = tmp.value.split(" ");
                lng = lngref * (eval(value[0]) + eval(value[1]) / 60 + eval(value[2]) / 3600);

                ret.push({
                    lat: lat,
                    lng: lng,
                    metaTypeName: metaTypeName
                });
                break;
            case "iptc":
                break;
            case "xmp":
                if (!(tmp = findMetaDatum(tags, "key", "Xmp.exif.GPSLatitude")))
                    continue;
                latref = tmp.value.search(/N/i) != -1 ? 1 : -1;
                value = tmp.value.replace(/(N|S)/i, "").split(",");
                lat = latref * (eval(value[0]) + eval(value[1]) / 60);

                if (!(tmp = findMetaDatum(tags, "key", "Xmp.exif.GPSLongitude")))
                    continue;
                lngref = tmp.value.search(/E/i) != -1 ? 1 : -1;
                value = tmp.value.replace(/(E|W)/i, "").split(",");
                lng = lngref * (eval(value[0]) + eval(value[1]) / 60);

                ret.push({
                    lat: lat,
                    lng: lng,
                    metaTypeName: metaTypeName
                });
                break;
        }
    }
    return ret;
}

function activateTooltip(selector) {
    $(selector).tooltip({
        track: true,
        tooltipClass: 'photoMetadataPrivacyTooltip',
        content: function() {
            return $(this).prop('title');
        },
        open: function(event, ui) {
            $('.ui-tooltip').wrap('<div class="photoMetadataPrivacyScope" />');
        },
        close: function(event, ui) {
            $(".photoMetadataPrivacyScope").filter(function() {
                if ($(this).text() == "")
                {
                    return true;
                }
                return false;
            }).remove();
        }
    });
}

function handleScannedImage(task, fileData, url, img, scanFilesIndex, flickrMeta) {
    responseHandler = (function(img, scanFilesIndex) {
        return function(response) {
            var hasGroups = {
                0: true
            };
            var groupTitles = {
                0: "Loading ...",
                1: chrome.i18n.getMessage("group_people"),
                2: chrome.i18n.getMessage("group_location"),
                3: chrome.i18n.getMessage("group_datetime"),
                4: chrome.i18n.getMessage("group_content"),
                5: chrome.i18n.getMessage("group_flickr"),
                6: chrome.i18n.getMessage("no_metadata")
            }
            var position = img.offset();
            var size = {
                width: img.outerWidth(),
                height: img.outerHeight()
            };

            var cssOverlay = {
                'display': $(img).css('display') == 'inline' ? 'inline-block' : $(img).css('display'),
                'float': $(img).css('float'),
                'position': $(img).css('position') == 'absolute' ? 'absolute' : 'relative',
                'clear': $(img).css('clear'),
                'padding': $(img).css('padding'),
                'margin': $(img).css('margin'),
                'top': $(img).css('top'),
                'left': $(img).css('left'),
                'right': $(img).css('right'),
                'bottom': $(img).css('bottom'),
                'height': $(img).css('height'),
                'width': $(img).css('width')
            };

            var cssImg = {
                'display': $(img).css('display'),
                'float': 'none',
                'clear': 'none',
                'position': 'static',
                'margin': '0',
                'padding': '0',
                'top': 0,
                'left': 0,
                'right': 0,
                'bottom': 0,
                'height': $(img).css('height'),
                'width': $(img).css('width')
            };
            $(img).wrap($('<span class="photoMetadataPrivacyImgOverlayContainer" />')
                    .css(cssOverlay)
                    );
            $(img).css(cssImg);

            if (flickrMeta) {
                scanFiles.changeFile("photoMetadataPrivacyWebFiles", scanFilesIndex, 'flickrMeta', response.flickrMeta);
                hasGroups[5] = true;
            } else {
                if (response.error) {
                    scanFiles.changeFile("photoMetadataPrivacyWebFiles", scanFilesIndex, 'deleted', true);
                    return true;
                }

                if (response.meta.exif == null && response.meta.iptc == null && response.meta.xmp == null) {
                    if (options.showNoMetaIcon) {
                        $(img).parent().append(
                                $('<span title="' + groupTitles[6] + '" />')
                                .addClass('photoMetadataPrivacyImgOverlay')
                                .addClass('photoMetadataPrivacyImgOverlayGroup-' + 6)
                                .css({/*
                                 'top': position['top'] + 5,
                                 'left': position['left'] + size.width - 22*/
                            'right': 5
                        })
                                .hover(function() {
                            $(this).animate({
                                'opacity': 1
                            }, 300)
                        }, function() {
                            $(this).animate({
                                'opacity': .7
                            }, 300)
                        }));
                    }
                    scanFiles.changeFile("photoMetadataPrivacyWebFiles", scanFilesIndex, 'deleted', true);
                    return true;
                }

                scanFiles.changeFile("photoMetadataPrivacyWebFiles", scanFilesIndex, 'fileData', response.fileData);
                scanFiles.changeFile("photoMetadataPrivacyWebFiles", scanFilesIndex, 'meta', response.meta);
                scanFiles.changeFile("photoMetadataPrivacyWebFiles", scanFilesIndex, 'width', response.width);
                scanFiles.changeFile("photoMetadataPrivacyWebFiles", scanFilesIndex, 'height', response.height);
                scanFiles.changeFile("photoMetadataPrivacyWebFiles", scanFilesIndex, 'mime', response.mime);
                scanFiles.changeFile("photoMetadataPrivacyWebFiles", scanFilesIndex, 'thumb', response.thumb);
                scanFiles.changeFile("photoMetadataPrivacyWebFiles", scanFilesIndex, 'size', Math.round(response.size / 1024));

                for (var metaTypeName in response.meta) {
                    var tags = response.meta[metaTypeName];
                    if (tags == null)
                        continue;
                    tags = objToArray(tags);
                    for (var tagIndex = 0, tag; tag = tags[tagIndex]; tagIndex++) {
                        if (metaTagsInfo[tag.key] != undefined && metaTagsInfo[tag.key].group > 0) {
                            hasGroups[metaTagsInfo[tag.key].group] = true;
                        }
                    }
                }
            }

            if (objLength(hasGroups) > 0) {
                var marginCount = 0;
                for (group in hasGroups) {
                    if (options['showIconGroup' + group]) {
                        $(img).parent().append(
                                $('<span title="' + groupTitles[group] + '" />')
                                .addClass('photoMetadataPrivacyImgOverlay')
                                .addClass('photoMetadataPrivacyImgOverlayGroup-' + group)
                                .click((function(response, scanFilesIndex) {
                            return function(e) {
                                e.stopPropagation();
                                e.preventDefault();
                                showImages(scanFiles, false, scanFilesIndex);
                            };

                        })(response, scanFilesIndex))
                                .css({
                            /* 'top': position['top'] + 5,
                             'left': position['left'] + size.width - 22 - (22 * marginCount)*/
                            'right': 5 + (22 * marginCount)
                        })
                                .appendTo(document.documentElement)
                                .hover(function() {
                            $(this).animate({
                                'opacity': 1
                            }, 300)
                        }, function() {
                            $(this).animate({
                                'opacity': .7
                            }, 300)
                        }));
                        marginCount++;
                    }
                }
            }
            return true;
        };

    })(img, scanFilesIndex);
    if (task == 'gotFlickrData') {
        responseHandler({
            flickrMeta: flickrMeta
        });
    } else {
        chrome.runtime.sendMessage({
            task: task,
            fileData: fileData,
            url: url
        },
        responseHandler);
    }
}

function scanImages($images) {
    if (!options.doScan || flickrScanned)
        return;
    flickr_pattern = /^https?:\/\/[^\/]*\bflickr\.com\/photos\/[^\/]+\/(\d+)\/?.*$/i;
    if (flickr_pattern.test(location.href)) {
        flickrScanned = true;
        flickrImageID = flickr_pattern.exec(location.href)[1];

        // we are on flickr and use flickr api
        var flickrData = {};
        $.when(
                $.ajax({
            'url': "http://api.flickr.com/services/rest/",
            'dataType': 'json',
            'data': {
                'method': 'flickr.photos.geo.getLocation',
                'api_key': 'e038f2c7db8528c947e02ee943a20fba',
                'photo_id': flickrImageID,
                'format': 'json',
                'nojsoncallback': '1'
            },
            'success': function(geoData) {
                if (geoData.stat == "ok" && geoData.photo && geoData.photo.location) {
                    flickrData.geo = geoData.photo.location;
                }
            }
        }),
        $.ajax({
            'url': "http://api.flickr.com/services/rest/",
            'dataType': 'json',
            'data': {
                'method': 'flickr.photos.getSizes',
                'api_key': 'e038f2c7db8528c947e02ee943a20fba',
                'photo_id': flickrImageID,
                'format': 'json',
                'nojsoncallback': '1'
            },
            'success': function(sizeData) {
                if (sizeData.stat == "ok" && sizeData.sizes && sizeData.sizes.size) {
                    flickrData.size = sizeData.sizes.size;
                }
            }
        }),
        $.ajax({
            'url': "http://api.flickr.com/services/rest/",
            'dataType': 'json',
            'data': {
                'method': 'flickr.photos.getExif',
                'api_key': 'e038f2c7db8528c947e02ee943a20fba',
                'photo_id': flickrImageID,
                'format': 'json',
                'nojsoncallback': '1'
            },
            'success': function(flickrMeta) {
                if (flickrMeta.stat == "ok" && flickrMeta.photo && flickrMeta.photo.exif) {
                    flickrData.flickrMeta = flickrMeta.photo.exif.sort(function(a, b) {
                        if (a.tag == b.tag)
                            return 0;
                        if (a.tag < b.tag)
                            return -1;
                        return 1;
                    });
                }
            }
        })).then(function() {
            if (objLength(flickrData) == 0)
                return;

            imgname = 'n/a';
            if ($('#title_div')) {
                imgname = $('#title_div').html();
            }
            //first parameter is fictive form field
            scanFiles.addImageFile("photoMetadataPrivacyWebFiles", 0, imgname, "", "");

            url = '';
            altUrl = '';

            if (flickrData.size) {
                altUrl = flickrData.size[flickrData.size.length - 1].source;
                scanFiles.changeFile("photoMetadataPrivacyWebFiles", 0, 'width', flickrData.size[flickrData.size.length - 1].width);
                scanFiles.changeFile("photoMetadataPrivacyWebFiles", 0, 'height', flickrData.size[flickrData.size.length - 1].height);
                for (var index = 0, size; size = flickrData.size[index]; index++) {
                    if (size.label == "Original") {
                        url = size.source;
                        altUrl = url;
                        break;
                    }
                }
            }
            if (altUrl == '') {
                altUrl = $("div.photo-div img:first").src;
            }

            if (flickrData.geo) {
                scanFiles.changeFile("photoMetadataPrivacyWebFiles", 0, 'lat', flickrData.geo.latitude);
                scanFiles.changeFile("photoMetadataPrivacyWebFiles", 0, 'lng', flickrData.geo.longitude);
            }

            scanFiles.changeFile("photoMetadataPrivacyWebFiles", 0, 'mime', "n/a");
            scanFiles.changeFile("photoMetadataPrivacyWebFiles", 0, 'size', "n/a");
            if (url) {
                // if we have the url of the original image, we can process it with nacl-module
                handleScannedImage("getMetaByUrl", "", url, $("div.photo-div img:visible:first"), 0);
            } else {
                //otherwise we have to use the metadata provided by flickr 
                scanFiles.changeFile("photoMetadataPrivacyWebFiles", 0, 'fileData', altUrl);
                handleScannedImage("gotFlickrData", "", "", $("div.photo-div img:first"), 0, flickrData.flickrMeta);
            }
        });

    } else {
        $images.each(function(i, v) {
            if ($(this).data('photoMetadataPrivacyScanned'))
                return;

            if (this.src.search(/data/i) !== 0) {
                for (var k = 0; k < options.blacklist.length; k++) {
                    if (this.src.search(options.blacklist[k]) != -1) {
                        return;
                    }
                }
            }

            $(this).data('photoMetadataPrivacyScanned', true);

            var img = $(this);
            var cond;
            if (options.conditionAnd) {
                cond = img.height() >= options.conditionMinHeight && img.width() >= options.conditionMinWidth;
            } else {
                cond = img.height() >= options.conditionMinHeight || img.width() >= options.conditionMinWidth;
            }
            if (cond) {
                if (this.src.search(/data/i) === 0) {
                    var fileData = this.src;
                    var url = "";
                    var task = "getMetaByDataUrl";
                    if (this.alt) {
                        var imgname = this.alt;
                    } else if (this.title) {
                        var imgname = this.title;
                    } else {
                        var imgname = "n/a";
                    }
                } else {
                    var fileData = "";
                    var url = this.src;
                    var task = "getMetaByUrl";
                    var imgname = this.src.substr(this.src.lastIndexOf("/") + 1);
                    imgname = imgname.indexOf('?') != -1 ? imgname.substr(0, imgname.indexOf('?')) : imgname;
                    imgname = imgname.indexOf('&') != -1 ? imgname.substr(0, imgname.indexOf('&')) : imgname;
                }

                if (url == fileData) {
                    return;
                }
                var scanFilesIndex = scanFilesIndexGlobal++;
                scanFiles.addImageFile("photoMetadataPrivacyWebFiles", scanFilesIndex, imgname, "", fileData);
                handleScannedImage(task, fileData, url, img, scanFilesIndex);
            }
        });
    }
}

//listener for message from background script
chrome.runtime.onMessage.addListener(
        function(request, sender, sendResponse) {
            if (request.task == 'getRightClickedElement') {
                sendResponse({name: rightclickedItem.name, title: rightclickedItem.title});
            }
            if (request.task == 'loading') {
                showLoading();
                return true;
            }
            if (request.task == 'showMeta') {
                if (request.error) {
                    alert('PhotoMetadataPrivacy: Es trat ein Fehler auf: ' + request.error);
                    removeOverlay();
                } else {
                    showMeta(request);
                }
                return true;
            }
            return false;
        });

// add custom javascript to websites javascript
function injectWebScript() {
    webScript = function webPhotoMetadataPrivacy(respectSupportInputField) {
        Array.prototype.slice.call(document.querySelectorAll('form')).forEach(function(element, index) {
            if ((!respectSupportInputField ||
                    element.querySelectorAll('input[name="supportPhotoMetadataPrivacy"]').length ||
                    element.querySelectorAll('input[name="supportPhotoMetadataPrivacyMetadataService"]').length)
                    && element.querySelectorAll('input[type="file"]').length) {
                element.submit = function() {
                };
            }
        });
        return true;
    };

    script = "(" + webScript.toString() + ")(" + options.respectSupportInputField + ");"

    var s = document.createElement("script");
    s.type = "text/javascript";
    s.onload = function() {
        this.parentNode.removeChild(this);
    };
    s.innerHTML = script;
    (document.head || document.documentElement).appendChild(s);
}

function init() {
    if (typeof disalbePhotoMetadataPrivacyContentScriptInit != "undefined") {
        return;
    }
    if (observer) {
        observer.disconnect();
    }
    chrome.runtime.sendMessage({
        task: "getOptions"
    }, function(response) {
        options = response.options;
        metaTagsInfo = response.metaTagsInfo;
        for (var k = 0; k < options.blacklist.length; k++) {
            options.blacklist[k] = new RegExp(options.blacklist[k]);
        }
        injectWebScript();
        imgFiles = new ImgFiles;
        scanFiles = new ImgFiles;
        sendMessageWait = 0;
        sendExvMessageWait = 0;
        flickrScanned = false;
        form = null;
        addSubmitHandler();
        scanFilesIndexGlobal = 0;

        // check if there are images inserted  while website is already opened
        observer = new WebKitMutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                $this = $(mutation.addedNodes);
                // ingore if extension inserts elements!				
                if ($this.parents('.photoMetadataPrivacyScope').length || $this.hasClass('photoMetadataPrivacyScope')) {
                    return;
                }
                //only look for images
                $img = $this.find('img:visible');
                if ($this.is('img')) {
                    $img = $img.add($this);
                }
                if ($img.length) {
                    $img.each(function() {
                        if (this.complete) {
                            scanImages($(this));
                        } else {
                            $(this).load(function() {
                                scanImages($(this));
                            });
                        }
                    });
                }
            });
        });
        observer.observe(document.querySelector('html'), {
            childList: true,
            subtree: true
        });

        // Record the last element to be right-clicked
        rightclickedItem = null;
        $("html").bind("contextmenu", function(e) {
            rightclickedItem = e.target;
        }).click(function() {
            rightclickedItem = null;
        });

        scanImages($("img:visible"));

        return true;
    });
}

metaTagsInfo = null;
observer = null;
imgFiles = null;
scanFiles = null;
sendMessageWait = null;
sendExvMessageWait = null;
flickrScanned = false;
form = null;
options = {};
scanFilesIndexGlobal = 0;
rightclickedItem = null;

$(document).ready(init);

