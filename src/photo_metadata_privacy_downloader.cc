/*
 *  photo_metadata_privacy_downloader.cc / photo_metadata_privacy_downloader.cc
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


#include <stdio.h>
#include <stdlib.h>
#include "ppapi/c/pp_errors.h"
#include "ppapi/c/ppb_instance.h"
#include "ppapi/cpp/module.h"
#include "ppapi/cpp/var.h"


#include <exiv2/exiv2.hpp>

#include "photo_metadata_privacy_downloader.h"

#ifdef WIN32
#undef min
#undef max
#undef PostMessage
#endif
using Exiv2::byte;

PhotoMetadataPrivacyDownloader* PhotoMetadataPrivacyDownloader::Create(PhotoMetadataPrivacyInstance* instance,
        const std::string& url, const unsigned int& responsePointer) {
    return new PhotoMetadataPrivacyDownloader(instance, url, responsePointer);
}

PhotoMetadataPrivacyDownloader::PhotoMetadataPrivacyDownloader(PhotoMetadataPrivacyInstance* instance,
        const std::string& url, const unsigned int& responsePointer)
: instance_(instance),
url_(url),
url_request_(instance),
url_loader_(instance),
buffer_(new char[READ_BUFFER_SIZE]),
cc_factory_(this),
_responsePointer(responsePointer) {
    url_request_.SetURL(url);
    url_request_.SetMethod("GET");
    url_request_.SetRecordDownloadProgress(true);
}

PhotoMetadataPrivacyDownloader::~PhotoMetadataPrivacyDownloader() {
    delete [] buffer_;
    buffer_ = NULL;
}

void PhotoMetadataPrivacyDownloader::Start() {
    pp::CompletionCallback cc =
            cc_factory_.NewCallback(&PhotoMetadataPrivacyDownloader::OnOpen);
    url_loader_.Open(url_request_, cc);
}

void PhotoMetadataPrivacyDownloader::OnOpen(int32_t result) {
    if (result != PP_OK) {
        ReportResultAndDie("pp::URLLoader::Open() failed", false);
        return;
    }
    pp::URLResponseInfo response = url_loader_.GetResponseInfo();
    
    int32_t statusCode = response.GetStatusCode();

    if (statusCode != 200) {
        ReportResultAndDie("pp::URLLoader::Open() status code failed", false);
        return;
    }

    // Try to figure out how many bytes of data are going to be downloaded in
    // order to allocate memory for the response body in advance (this will
    // reduce heap traffic and also the amount of memory allocated).
    // It is not a problem if this fails, it just means that the
    // url_response_body_.insert() call in PhotoMetadataPrivacyDownloader::AppendDataBytes()
    // will allocate the memory later on.
    int64_t bytes_received = 0;
    int64_t total_bytes_to_be_received = 0;
    if (url_loader_.GetDownloadProgress(&bytes_received,
            &total_bytes_to_be_received)) {
        if (total_bytes_to_be_received > 0) {
            url_response_body_.reserve(total_bytes_to_be_received);
        }
    }
    // We will not use the download progress anymore, so just disable it.
    url_request_.SetRecordDownloadProgress(false);

    // Start streaming.
    ReadBody();
}

void PhotoMetadataPrivacyDownloader::AppendDataBytes(const char* buffer, int32_t num_bytes) {
    if (num_bytes <= 0)
        return;
    // Make sure we don't get a buffer overrun.
    num_bytes = std::min(READ_BUFFER_SIZE, num_bytes);
    url_response_body_.insert(url_response_body_.end(),
            buffer,
            buffer + num_bytes);
}

void PhotoMetadataPrivacyDownloader::OnRead(int32_t result) {
    if (result == PP_OK) {
        // Streaming the file is complete, delete the read buffer since it is
        // no longer needed.
        delete [] buffer_;
        buffer_ = NULL;
        ReportResultAndDie("", true);
    } else if (result > 0) {
        // The URLLoader just filled "result" number of bytes into our buffer.
        // Save them and perform another read.
        AppendDataBytes(buffer_, result);
        ReadBody();
    } else {
        // A read error occurred.
        ReportResultAndDie("pp::URLLoader::ReadResponseBody() result<0",
                false);
    }
}

void PhotoMetadataPrivacyDownloader::ReadBody() {
    // Note that you specifically want an "optional" callback here. This will
    // allow ReadBody() to return synchronously, ignoring your completion
    // callback, if data is available. For fast connections and large files,
    // reading as fast as we can will make a large performance difference
    // However, in the case of a synchronous return, we need to be sure to run
    // the callback we created since the loader won't do anything with it.
    pp::CompletionCallback cc =
            cc_factory_.NewOptionalCallback(&PhotoMetadataPrivacyDownloader::OnRead);
    int32_t result = PP_OK;
    do {
        result = url_loader_.ReadResponseBody(buffer_, READ_BUFFER_SIZE, cc);
        // Handle streaming data directly. Note that we *don't* want to call
        // OnRead here, since in the case of result > 0 it will schedule
        // another call to this function. If the network is very fast, we could
        // end up with a deeply recursive stack.
        if (result > 0) {
            AppendDataBytes(buffer_, result);
        }
    } while (result > 0);

    if (result != PP_OK_COMPLETIONPENDING) {
        // Either we reached the end of the stream (result == PP_OK) or there was
        // an error. We want OnRead to get called no matter what to handle
        // that case, whether the error is synchronous or asynchronous. If the
        // result code *is* COMPLETIONPENDING, our callback will be called
        // asynchronously.
        cc.Run(result);
    }
}

void PhotoMetadataPrivacyDownloader::ReportResultAndDie(const std::string& text,
        bool success) {
    if (success) {
        printf("PhotoMetadataPrivacyDownloader::ReportResult(Ok).\n");
        if (instance_) {
            std::vector<byte> data(url_response_body_.begin(), url_response_body_.end());
            instance_->downloadCallback(data, true, _responsePointer);
        }
    } else {
        printf("PhotoMetadataPrivacyDownloader::ReportResult(Err). %s\n", text.c_str());
        if (instance_) {
            instance_->downloadCallback(std::vector<byte>(), false, _responsePointer);
        }
    }
    fflush(stdout);
    delete this;
}

