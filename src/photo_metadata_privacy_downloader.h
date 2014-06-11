// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef PHOTO_METADATA_PRIVACY_DOWNLOADER_H
#define PHOTO_METADATA_PRIVACY_DOWNLOADER_H

#include <string>
#include "ppapi/cpp/completion_callback.h"
#include "ppapi/cpp/url_loader.h"
#include "ppapi/cpp/url_request_info.h"
#include "ppapi/cpp/url_response_info.h"
#include "ppapi/cpp/instance.h"
#include "ppapi/utility/completion_callback_factory.h"
#define READ_BUFFER_SIZE 32768

#include <exiv2/exiv2.hpp>

#include "photo_metadata_privacy.h"

using Exiv2::byte;

// PhotoMetadataPrivacyDownloader is used to download data from |url|. When download is
// finished or when an error occurs, it posts a message back to the browser
// with the results encoded in the message as a string and self-destroys.
//
// pp::URLLoader.GetDownloadProgress() is used to to allocate the memory
// required for url_response_body_ before the download starts.  (This is not so
// much of a performance improvement, but it saves some memory since
// std::string.insert() typically grows the string's capacity by somewhere
// between 50% to 100% when it needs more memory, depending on the
// implementation.)  Other performance improvements made as outlined in this
// bug: http://code.google.com/p/chromium/issues/detail?id=103947
//
// EXAMPLE USAGE:
// PhotoMetadataPrivacyDownloader* handler* = PhotoMetadataPrivacyDownloader::Create(instance,url);
// handler->Start();
//
class PhotoMetadataPrivacyDownloader {
 public:
  // Creates instance of PhotoMetadataPrivacyDownloader on the heap.
  // PhotoMetadataPrivacyDownloader objects shall be created only on the heap (they
  // self-destroy when all data is in).
  static PhotoMetadataPrivacyDownloader* Create(PhotoMetadataPrivacyInstance* instance_,
                               const std::string& url, const unsigned int& responsePointer);
  // Initiates page (URL) download.
  void Start();

 private:
  PhotoMetadataPrivacyDownloader(PhotoMetadataPrivacyInstance* instance_, const std::string& url, const unsigned int& responsePointer);
  ~PhotoMetadataPrivacyDownloader();

  // Callback fo the pp::URLLoader::Open().
  // Called by pp::URLLoader when response headers are received or when an
  // error occurs (in response to the call of pp::URLLoader::Open()).
  // Look at <ppapi/c/ppb_url_loader.h> and
  // <ppapi/cpp/url_loader.h> for more information about pp::URLLoader.
  void OnOpen(int32_t result);

  // Callback fo the pp::URLLoader::ReadResponseBody().
  // |result| contains the number of bytes read or an error code.
  // Appends data from this->buffer_ to this->url_response_body_.
  void OnRead(int32_t result);

  // Reads the response body (asynchronously) into this->buffer_.
  // OnRead() will be called when bytes are received or when an error occurs.
  void ReadBody();

  // Append data bytes read from the URL onto the internal buffer.  Does
  // nothing if |num_bytes| is 0.
  void AppendDataBytes(const char* buffer, int32_t num_bytes);

  // Post a message back to the browser with the download results and
  // self-destroy.  |this| is no longer valid when this method returns.
  void ReportResultAndDie(const std::string& text,
                          bool success);

  PhotoMetadataPrivacyInstance* instance_;  // Weak pointer.
  std::string url_;  // URL to be downloaded.
  pp::URLRequestInfo url_request_;
  pp::URLLoader url_loader_;  // URLLoader provides an API to download URLs.
  char* buffer_;  // Temporary buffer for reads.
  std::string url_response_body_;  // Contains accumulated downloaded data.
  pp::CompletionCallbackFactory<PhotoMetadataPrivacyDownloader> cc_factory_;
  int _responsePointer;

  PhotoMetadataPrivacyDownloader(const PhotoMetadataPrivacyDownloader&);
  void operator=(const PhotoMetadataPrivacyDownloader&);
};

#endif  // PHOTO_METADATA_PRIVACY_DOWNLOADER_H

