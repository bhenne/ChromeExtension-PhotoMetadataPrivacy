// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include <cassert>
#include <cmath>
#include <limits>
#include <sstream>
#include <vector>
#include <algorithm>
#include "ppapi/cpp/audio.h"
#include "ppapi/cpp/instance.h"
#include "ppapi/cpp/module.h"
#include "ppapi/cpp/var.h"

#include "ppapi/cpp/url_loader.h"

#include "base64.h"
#include "photo_metadata_privacy_downloader.h"

#include <exiv2/exiv2.hpp>
#include <json/json.h>


#ifndef PHOTO_METADATA_PRIVACY_H
#define PHOTO_METADATA_PRIVACY_H

using Exiv2::byte;
class PhotoMetadataPrivacyInstance : public pp::Instance {
	public:
		explicit PhotoMetadataPrivacyInstance(PP_Instance instance) : pp::Instance(instance) {}
		virtual ~PhotoMetadataPrivacyInstance() {}

		// Called by the browser once the NaCl module is loaded and ready to
		// initialize. Returns true on success. Returning false causes the NaCl module to be deleted and
		// no other functions to be called.
		virtual bool Init(uint32_t argc, const char* argn[], const char* argv[]);

		// Called by the browser to handle the postMessage() call in Javascript.
		virtual void HandleMessage(const pp::Var& var_message);
		
        //Called by the Downloader to process the downloaded file
		virtual void downloadCallback(std::vector<uint8_t>, bool success, const unsigned int& responsePointer);

	private: 
        //Contains the images as Data-Url
		std::vector<std::string> _fileData;
        //Contains the Web-Urls of the images 
		std::vector<std::string> _url;
        //Points to the beginnings of the binary data of the images
		std::vector<byte*> _imageDataBegin;
        //Contains the binary data of an images
		std::vector<std::vector<byte> > _imageData;
        // maximimum size of vectors, calculated by the highest response pointer
		unsigned int _maxResponsePointer;
        
        // Returns an Exiv2 object of an image 
		Exiv2::Image::AutoPtr getImage(const unsigned int& responsePointer);
        // Sets the binary data of an image
		void setImageData(std::vector<uint8_t>, const unsigned int& responsePointer);
        // converts the Data-Url of an image to binary data 
		bool parseDataUrl(const unsigned int& responsePointer);
        // creates a Data-Url from binary data of an image
		std::string createDataUrl(const std::string mime, const unsigned int& responsePointer);
        //sends an error to the browser
		void error(const std::string& msg, const unsigned int& responsePointer);
        // free the space used by an imageand delete it
		void cleanup(const unsigned int& responsePointer);
        // extracts metadata from binary image data and sends it to the browser
		void getAndSendMeta(const unsigned int& responsePointer);
        // deletes a metatag from the binary data of an image
		bool deleteMetaTag(std::string key, std::string metaType, const unsigned int& responsePointer);
		bool deleteThumb(const unsigned int& responsePointer);
        // edit a metatag from binary data of an image
		bool editMetaTag(std::string key, std::string metaType, Json::Value value, std::string typeName, std::string valueType, const unsigned int& responsePointer);
        // create an exv file of the images metadata
		bool createExv(const unsigned int& responsePointer);
        // delete ALL of the images metadata
		bool deleteAllMeta(const unsigned int& responsePointer);
        
		std::string intToString(int input);
		int stringToInt(std::string input);		
};
#endif 