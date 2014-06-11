"""Upload Proof-of-Concept Site based on cherrypy"""

__author__  = 'B. Henne'
__contact__ = 'henne@dcsec.uni-hannover.de'
__license__ = 'GPLv3'

import cherrypy
import tempfile
import os

class UploadTestSite:

    @cherrypy.expose
    def index(self):
        imgs = ''
        for subdir, dirs, files in os.walk(tmp):
            for file in files:
                imgs += '<img src="/imgs/%s"><br />' % file
        return """<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/strict.dtd">
<html>
<head>
</head>
<body>
<h1>Proof-of-Concept</h1>
<h2>Upload</h2>
<form method="post" action="upload" enctype="multipart/form-data">
 <input type="hidden" name="supportPhotoMetadataPrivacy" />
 <input type="file" name="myfiles" multiple><br />
 <input type="submit" />
</form>
<h2>Clean up</h2>
<p><a href="cleanup">Remove uploaded files</a></p>
<h2>Uploaded Images</h2>
%s
</body>
</html>
""" % imgs

    @cherrypy.expose
    def upload(self, myfiles, supportPhotoMetadataPrivacy):
        if type(myfiles) != list:
            myfiles = [myfiles]
        for thefile in myfiles:
            f = open(os.path.join(tmp, thefile.filename), 'wb')
            while True:
                data = thefile.file.read(8192)
                if not data:
                    break
                f.write(data)
            f.close()
        raise cherrypy.HTTPRedirect("/")

    @cherrypy.expose
    def cleanup(self):
        cleanup()
        raise cherrypy.HTTPRedirect("/")

tmp = 'tmpimgs'

def init():
    if not os.path.exists(tmp):
        os.mkdir(tmp)

def cleanup():
    for subdir, dirs, files in os.walk(tmp):
        for delfile in files:
            os.remove(os.path.join(tmp, delfile))

def destroy():
    cleanup()
    os.rmdir(tmp)

if __name__ == '__main__':
    init()
    cherrypy.config.update( {'server.socket_host':"0.0.0.0", 'server.socket_port':8080 } )
    current_dir = os.path.dirname(os.path.abspath(__file__))
    conf = { '/imgs': {'tools.staticdir.on': True,
             'tools.staticdir.dir': os.path.join(current_dir, tmp) }
    }
    cherrypy.quickstart(UploadTestSite(), config=conf)
    destroy()

