/* 
 *   photo_metadata_privacy.cc / photo_metadata_privacy.h
 *
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
 * 
 */


#include <cassert>
#include <cmath>
#include <inttypes.h>
#include <limits>
#include <sstream>
#include <stdio.h>
#include <vector>
#include <cstdlib>
#include <algorithm>
#include "ppapi/cpp/audio.h"
#include "ppapi/cpp/instance.h"
#include "ppapi/cpp/module.h"
#include "ppapi/cpp/var.h"

#include "ppapi/cpp/url_loader.h"

#include "photo_metadata_privacy.h"

#include "base64.h"
#include "photo_metadata_privacy_downloader.h"
#include <json/json.h>

#include <exiv2/exiv2.hpp>

template <typename T>
std::string ToString(T Number) {
    std::ostringstream ss;
    ss << Number;
    return ss.str();
}

using Exiv2::byte;

bool PhotoMetadataPrivacyInstance::Init(uint32_t argc, const char* argn[], const char* argv[]) {
    _maxResponsePointer = 0;
    return true;
}

void PhotoMetadataPrivacyInstance::HandleMessage(const pp::Var& var_message) {
    if (!var_message.is_string()) {
        return;
    }
    std::string message = var_message.AsString();

    Json::Value root; // will contains the root value after parsing.
    Json::Reader reader;

    if (!reader.parse(message, root)) {
        // report to the user the failure and their locations in the document.
        fprintf(stdout, "Failed to parse json: %s\n", ToString(reader.getFormatedErrorMessages()).c_str());
        fflush(stdout);
        return;
    }

    unsigned int responsePointer = root["responsePointer"].asInt();
    std::string fileData = root["fileData"].asString();
    std::string url = root["url"].asString();

    // the response pointer identifies a valid request and is required
    // it is used as index for data of the image in global vectors
    if (responsePointer == 0) {
        fprintf(stdout, "No responsePointer");
        fflush(stdout);
        return;
    }
    // either the image itself or an url to that image is required
    if (fileData == "" && url == "") {
        fprintf(stdout, "No fileData or url");
        fflush(stdout);
        return;
    }

    if (responsePointer > _maxResponsePointer) {
        _maxResponsePointer = responsePointer;

        _imageDataBegin.reserve(_maxResponsePointer + 1);
        _imageDataBegin.resize(_maxResponsePointer + 1);

        _imageData.reserve(_maxResponsePointer + 1);
        _imageData.resize(_maxResponsePointer + 1);

        _fileData.reserve(_maxResponsePointer + 1);
        _fileData.resize(_maxResponsePointer + 1);

        _url.reserve(_maxResponsePointer + 1);
        _url.resize(_maxResponsePointer + 1);
    }

    _fileData[responsePointer] = fileData;
    _url[responsePointer] = url;

    std::string task = root["task"].asString();
    fprintf(stdout, "Task: %s \n", task.c_str());
    fflush(stdout);
    if (task == "getMetaByUrl") {
        PhotoMetadataPrivacyDownloader* handler = PhotoMetadataPrivacyDownloader::Create(this, _url[responsePointer], responsePointer);
        if (handler != NULL) {
            handler->Start();
        } else {
            error("Download handler failed", responsePointer);
        }
    } else if (task == "getMetaByDataUrl") {
        if (parseDataUrl(responsePointer)) {
            getAndSendMeta(responsePointer);
        } else {
            error("Invalid dataUrl", responsePointer);
        }
    } else if (task == "deleteMeta") {
        if (parseDataUrl(responsePointer)) {
            deleteMetaTag(root["key"].asString(), root["metaTypeName"].asString(), responsePointer);
            getAndSendMeta(responsePointer);
        } else {
            error("Invalid dataUrl", responsePointer);
        }
    } else if (task == "deleteThumb") {
        if (parseDataUrl(responsePointer)) {
            deleteThumb(responsePointer);
            getAndSendMeta(responsePointer);
        } else {
            error("Invalid dataUrl", responsePointer);
        }
    } else if (task == "editMeta") {
        if (parseDataUrl(responsePointer)) {
            std::string typeName = root["typeName"].asString();
            editMetaTag(root["key"].asString(), root["metaTypeName"].asString(), root["value"], root["typeName"].asString(), root["valueType"].asString(), responsePointer);
            getAndSendMeta(responsePointer);
        } else {
            error("Invalid dataUrl", responsePointer);
        }
    } else if (task == "getExv") {
        if (parseDataUrl(responsePointer)) {
            createExv(responsePointer);
            getAndSendMeta(responsePointer);
        } else {
            error("Invalid dataUrl", responsePointer);
        }
    } else if (task == "deleteAllMeta") {
        if (parseDataUrl(responsePointer)) {
            deleteAllMeta(responsePointer);
            getAndSendMeta(responsePointer);
        } else {
            error("Invalid dataUrl", responsePointer);
        }
    } else {
        error("Invalid task", responsePointer);
    }
}

bool PhotoMetadataPrivacyInstance::parseDataUrl(const unsigned int& responsePointer) {
    size_t sep_pos;
    // the data of the file starts after the first ',' and is base64-encoded
    sep_pos = _fileData[responsePointer].find_first_of(',');
    std::string base64data = _fileData[responsePointer].substr(sep_pos + 1);
    std::string decoded = base64_decode(base64data);

    std::vector<byte> data(decoded.begin(), decoded.end());

    setImageData(data, responsePointer);

    return true;
}

bool PhotoMetadataPrivacyInstance::createExv(const unsigned int& responsePointer) {
    Exiv2::Image::AutoPtr sourceImage = getImage(responsePointer);
    sourceImage->readMetadata();

    Exiv2::Image::AutoPtr targetImage = Exiv2::ImageFactory::create(Exiv2::ImageType::exv);

    if (!sourceImage->exifData().empty()) {
        targetImage->setExifData(sourceImage->exifData());
    }
    if (!sourceImage->iptcData().empty()) {
        targetImage->setIptcData(sourceImage->iptcData());
    }
    if (!sourceImage->xmpData().empty()) {
        targetImage->setXmpData(sourceImage->xmpData());
    }
    if (!sourceImage->comment().empty()) {
        targetImage->setComment(sourceImage->comment());
    }
    targetImage->writeMetadata();

    // extract the binary data from Exiv object and save it 
    std::vector<byte> data;
    byte * dataPointer = targetImage->io().mmap();
    long size = targetImage->io().size();

    for (long i = 0; i < size; i++) {
        data.push_back(dataPointer[i]);
    }

    setImageData(data, responsePointer);

    return true;
}

bool PhotoMetadataPrivacyInstance::deleteAllMeta(const unsigned int& responsePointer) {
    Exiv2::Image::AutoPtr image = getImage(responsePointer);
    //writing without setting metadata will erase all metadata!
    image->writeMetadata();

    // extract the binary data from Exiv object and save it 
    std::vector<byte> data;
    byte * dataPointer = image->io().mmap();
    long size = image->io().size();

    for (long i = 0; i < size; i++) {
        data.push_back(dataPointer[i]);
    }

    setImageData(data, responsePointer);
    return true;
}

bool PhotoMetadataPrivacyInstance::editMetaTag(std::string key, std::string metaTypeName, Json::Value value, std::string typeName, std::string valueType, const unsigned int& responsePointer) {
    Exiv2::Image::AutoPtr image = getImage(responsePointer);
    image->readMetadata();

    // values is always an array, even for one value. Thre index is of type unsigned int
    unsigned int firstPos = 0;
    // we have to extract all metadata, because writeMetadata() would overwrite them
    Exiv2::ExifData &exifData = image->exifData();
    Exiv2::IptcData &iptcData = image->iptcData();
    Exiv2::XmpData &xmpData = image->xmpData();
    // we have to delete the key first, because overwriting it caused bugs sometimes
    deleteMetaTag(key, metaTypeName, responsePointer);
    if (metaTypeName == "exif") {
        exifData[key] = value[firstPos].asString();
    } else if (metaTypeName == "iptc") {
        iptcData[key] = value[firstPos].asString();
    } else if (metaTypeName == "xmp") {
        Exiv2::Value::AutoPtr v;
        // only for sequences value may be a greater arrayand each value has to be read
        if (valueType == "xaSeq") {
            v = Exiv2::Value::create(Exiv2::xmpSeq);

            for (unsigned int index = 0; index < value.size(); ++index) {
                v->read(value[index].asString());
            }
            xmpData.add(Exiv2::XmpKey(key), v.get());
        } else {
            xmpData[key] = value[firstPos].asString();
        }
    }
    image->setExifData(exifData);
    image->setIptcData(iptcData);
    image->setXmpData(xmpData);
    image->writeMetadata();

    // extract the binary data from Exiv object and save it 
    std::vector<byte> data;
    byte * dataPointer = image->io().mmap();
    long size = image->io().size();

    for (long i = 0; i < size; i++) {
        data.push_back(dataPointer[i]);
    }

    setImageData(data, responsePointer);
    return true;
}

bool PhotoMetadataPrivacyInstance::deleteMetaTag(std::string key, std::string metaTypeName, const unsigned int& responsePointer) {
    Exiv2::Image::AutoPtr image = getImage(responsePointer);
    image->readMetadata();

    Exiv2::ExifData &exifData = image->exifData();
    Exiv2::IptcData &iptcData = image->iptcData();
    Exiv2::XmpData &xmpData = image->xmpData();

    std::string iKey;
    // iterate through the metadata, find the key and remove it.    
    if (metaTypeName == "exif") {
        for (Exiv2::ExifData::iterator i1 = exifData.begin(); i1 != exifData.end(); ++i1) {
            iKey = i1->key();
            if (iKey == key) {
                exifData.erase(i1);
                break;
            }
        }
    } else if (metaTypeName == "iptc") {
        for (Exiv2::IptcData::iterator i2 = iptcData.begin(); i2 != iptcData.end(); ++i2) {
            iKey = i2->key();
            if (iKey == key) {
                iptcData.erase(i2);
                i2--;
            }
        }
    }
    if (metaTypeName == "xmp") {
        for (Exiv2::XmpData::iterator i3 = xmpData.begin(); i3 != xmpData.end(); ++i3) {
            iKey = i3->key();
            if (iKey.size() >= key.size()) {
                if (iKey.substr(0, key.size()) == key) {
                    xmpData.erase(i3);
                    i3--;
                }
            }
        }
    }
    image->setExifData(exifData);
    image->setIptcData(iptcData);
    image->setXmpData(xmpData);
    image->writeMetadata();

    image->readMetadata();

    std::vector<byte> data;
    byte * dataPointer = image->io().mmap();
    long size = image->io().size();

    for (long i = 0; i < size; i++) {
        data.push_back(dataPointer[i]);
    }

    setImageData(data, responsePointer);
    return true;
}

bool PhotoMetadataPrivacyInstance::deleteThumb(const unsigned int& responsePointer) {
    Exiv2::Image::AutoPtr image = getImage(responsePointer);
    image->readMetadata();

    Exiv2::ExifData &exifData = image->exifData();
    Exiv2::IptcData &iptcData = image->iptcData();
    Exiv2::XmpData &xmpData = image->xmpData();

    Exiv2::ExifThumb exifThumb(exifData);
    exifThumb.erase();
    
    image->setExifData(exifData);
    image->setIptcData(iptcData);
    image->setXmpData(xmpData);

    image->writeMetadata();

    image->readMetadata();

    std::vector<byte> data;
    byte * dataPointer = image->io().mmap();
    long size = image->io().size();

    for (long i = 0; i < size; i++) {
        data.push_back(dataPointer[i]);
    }

    setImageData(data, responsePointer);
    return true;
}

std::string PhotoMetadataPrivacyInstance::createDataUrl(const std::string mime, const unsigned int& responsePointer) {
    std::string decoded(_imageData[responsePointer].begin(), _imageData[responsePointer].end());
    std::string encoded = base64_encode(reinterpret_cast<const unsigned char*> (decoded.c_str()), decoded.length());
    return "data:" + mime + ";base64," + encoded;
}

void PhotoMetadataPrivacyInstance::downloadCallback(std::vector<byte> data, bool success, const unsigned int& responsePointer) {
    if (success) {
        setImageData(data, responsePointer);
        getAndSendMeta(responsePointer);
    } else {
        // there was an error downloading the image. 
        error("Could not download image", responsePointer);
    }
}

void PhotoMetadataPrivacyInstance::setImageData(std::vector<byte> data, const unsigned int& responsePointer) {
    _imageData[responsePointer] = data;
    _imageDataBegin[responsePointer] = &_imageData[responsePointer][0];
}

Exiv2::Image::AutoPtr PhotoMetadataPrivacyInstance::getImage(const unsigned int& responsePointer) {
    return Exiv2::ImageFactory::open(_imageDataBegin[responsePointer], _imageData[responsePointer].size());
}

void PhotoMetadataPrivacyInstance::getAndSendMeta(const unsigned int& responsePointer) {
    try {
        Exiv2::Image::AutoPtr image = getImage(responsePointer);
        image->readMetadata();

        Json::Value root, jMeta, jExif, jItcp, jXmp, jTmp;
        int loop;
        Exiv2::ExifData &exifData = image->exifData();
        Exiv2::IptcData &iptcData = image->iptcData();
        Exiv2::XmpData &xmpData = image->xmpData();
        int counter;
        if (!exifData.empty()) {
            exifData.sortByKey();
            counter = 0;
            Exiv2::ExifData::const_iterator exifEnd = exifData.end();
            for (Exiv2::ExifData::const_iterator i1 = exifData.begin(); i1 != exifEnd; ++i1) {
                jExif[ToString(counter)]["key"] = i1->key();
                jExif[ToString(counter)]["tagName"] = i1->tagName();
                jExif[ToString(counter)]["typeName"] = std::string(i1->typeName());
                jExif[ToString(counter)]["value"] = i1->value().toString();
                jExif[ToString(counter)]["valueType"] = "";
                counter++;
            }
        }
        if (!iptcData.empty()) {
            iptcData.sortByKey();
            counter = 0;

            pp::Var testutf;
            std::string g;

            Exiv2::IptcData::const_iterator itcpEnd = iptcData.end();
            for (Exiv2::IptcData::const_iterator i2 = iptcData.begin(); i2 != itcpEnd; ++i2) {
                g = i2->key();
                g += " ";
                // TODO dont fail with non utf8 meta data
                // if the value gets returned in a non utf8 charset, pp::Var will fail to save it.
                // therefore it can not be send to the browser
                testutf = pp::Var(i2->getValue()->toString());
                if (testutf.is_string()) {
                    jItcp[ToString(counter)]["key"] = i2->key();
                    jItcp[ToString(counter)]["tagName"] = i2->tagName();
                    jItcp[ToString(counter)]["typeName"] = std::string(i2->typeName());
                    jItcp[ToString(counter)]["value"] = i2->getValue()->toString();
                    jItcp[ToString(counter)]["valueType"] = "";
                } else {
                    fprintf(stdout, "failed utf8: %s\n", g.c_str());
                }
                counter++;
            }
        }

        if (!xmpData.empty()) {
            xmpData.sortByKey();
            counter = 0;
            pp::Var testutf;
            Exiv2::XmpData::const_iterator xmpEnd = xmpData.end();
            for (Exiv2::XmpData::const_iterator i3 = xmpData.begin(); i3 != xmpEnd; ++i3) {
                testutf = pp::Var(i3->getValue()->toString());
                if (testutf.is_string()) {
                    jXmp[ToString(counter)]["key"] = i3->key();
                    jXmp[ToString(counter)]["tagName"] = i3->tagName();
                    jXmp[ToString(counter)]["typeName"] = std::string(i3->typeName());

                    const Exiv2::XmpValue* xmpVal = (dynamic_cast<const Exiv2::XmpValue*> (i3->getValue().get()));
                    int switchenum = xmpVal->xmpArrayType();
                    if (i3->typeId() == Exiv2::langAlt) {
                        jXmp[ToString(counter)]["valueType"] = "LangAlt";
                        jXmp[ToString(counter)]["value"] = i3->toString(0);
                    } else {
                        switch (switchenum) {
                                // Alt, Bag and Seq are arrays and may have many values
                            case Exiv2::XmpValue::xaAlt:
                            {
                                jXmp[ToString(counter)]["valueType"] = "xaAlt";
                                jTmp.clear();
                                for (loop = 0; loop < i3->count(); loop++) {
                                    jTmp[loop] = i3->toString(loop);
                                }
                                jXmp[ToString(counter)]["value"] = jTmp;
                                break;
                            }
                            case Exiv2::XmpValue::xaBag:
                            {
                                jXmp[ToString(counter)]["valueType"] = "xaBag";
                                jTmp.clear();
                                for (loop = 0; loop < i3->count(); loop++) {
                                    jTmp[loop] = i3->toString(loop);
                                }
                                jXmp[ToString(counter)]["value"] = jTmp;
                                break;
                            }
                            case Exiv2::XmpValue::xaSeq:
                            {
                                jXmp[ToString(counter)]["valueType"] = "xaSeq";
                                jTmp.clear();
                                for (loop = 0; loop < i3->count(); loop++) {
                                    jTmp[loop] = i3->toString(loop);
                                }
                                jXmp[ToString(counter)]["value"] = jTmp;
                                break;
                            }
                            case Exiv2::XmpValue::xaNone:
                            {
                                switchenum = (dynamic_cast<const Exiv2::XmpValue*> (i3->getValue().get()))->xmpStruct();
                                switch (switchenum) {
                                        // a structure contains manchild items. 
                                        // value will be ignored in browser. this metadatum is just a container for others
                                    case Exiv2::XmpValue::xsStruct:
                                    {
                                        jXmp[ToString(counter)]["valueType"] = "xsStruct";
                                        jXmp[ToString(counter)]["value"] = i3->value().toString();
                                        break;
                                    }
                                        // finally metadata that are only strings
                                    case Exiv2::XmpValue::xsNone:
                                    {
                                        jXmp[ToString(counter)]["valueType"] = "xsNone";
                                        jXmp[ToString(counter)]["value"] = i3->value().toString();
                                        break;
                                    }
                                }
                                break;
                            }
                        }
                    }

                    counter++;
                }
            }
        }

        Exiv2::ExifThumbC exifThumb(image->exifData());
        Exiv2::DataBuf thumb = exifThumb.copy();


        std::vector<byte> thumbData;

        for (long i = 0; i < thumb.size_; i++) {
            thumbData.push_back(thumb.pData_[i]);
        }

        std::string decoded(thumbData.begin(), thumbData.end());
        std::string encoded = base64_encode(reinterpret_cast<const unsigned char*> (decoded.c_str()), decoded.length());

        if (encoded.length()) {
            root["thumb"] = "data:" + std::string(exifThumb.mimeType()) + ";base64," + encoded;
        } else {
            root["thumb"] = "";
        }


        root["responsePointer"] = responsePointer;
        root["url"] = _url[responsePointer];

        jMeta["exif"] = jExif;
        jMeta["iptc"] = jItcp;
        jMeta["xmp"] = jXmp;
        root["meta"] = jMeta;

        root["size"] = _imageData[responsePointer].size();
        root["width"] = image->pixelWidth();
        root["height"] = image->pixelHeight();
        root["mime"] = image->mimeType();
        root["fileData"] = createDataUrl(image->mimeType(), responsePointer);

        Json::StyledWriter writer;
        PostMessage(pp::Var(writer.write(root)));
        //finally we delete all used space for better performance 
        cleanup(responsePointer);
    } catch (...) {
        error("Error: corrupted image", responsePointer);
    }
}

void PhotoMetadataPrivacyInstance::cleanup(const unsigned int& responsePointer) {
    _fileData[responsePointer] = "";
    _imageDataBegin[responsePointer] = NULL;
    _imageData[responsePointer].resize(0);
}

void PhotoMetadataPrivacyInstance::error(const std::string& msg, const unsigned int& responsePointer) {
    Json::Value root;
    root["error"] = msg;
    root["responsePointer"] = responsePointer;
    Json::StyledWriter writer;
    PostMessage(pp::Var(writer.write(root)));
    cleanup(responsePointer);
}

std::string PhotoMetadataPrivacyInstance::intToString(int input) {
    return static_cast<std::ostringstream*> (&(std::ostringstream() << input))->str();
}

int PhotoMetadataPrivacyInstance::stringToInt(std::string input) {
    int ret;
    std::stringstream ss(input);
    ss >> ret;
    return ret;
}

class PhotoMetadataPrivacyModule : public pp::Module {
public:

    PhotoMetadataPrivacyModule() : pp::Module() {
    }

    ~PhotoMetadataPrivacyModule() {
    }

    virtual pp::Instance* CreateInstance(PP_Instance instance) {
        return new PhotoMetadataPrivacyInstance(instance);
    }
};


// Factory function called by the browser when the module is first loaded.
// The browser keeps a singleton of this module.  It calls the
// CreateInstance() method on the object you return to make instances.  There
// is one instance per <embed> tag on the page.  This is the main binding
// point for your NaCl module with the browser.
namespace pp {

    Module* CreateModule() {
        return new PhotoMetadataPrivacyModule();
    }
} // namespace pp
