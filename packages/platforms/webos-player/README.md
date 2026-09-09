# webOS Player

## SCAP API libraries

The SCAP API libraries are required to build and package the player for LG webOS
Signage displays, but are not distributed in this repository.

1. Download the SCAP API libraries for versions 1.5 and 1.7 from the
   [LG webOS Signage Developer site](https://webossignage.developer.lge.com/).
2. Extract them into `public/lib/` so the directories have this structure:

   ```text
   public/lib/
   ├── scap_1.5/
   │   ├── cordova/
   │   │   └── 2.7.0/
   │   │       └── cordova.webos.js
   │   └── cordova-cd/
   │       ├── configuration.js
   │       ├── deviceInfo.js
   │       ├── inputSource.js
   │       ├── power.js
   │       ├── security.js
   │       ├── signage.js
   │       ├── sound.js
   │       ├── storage.js
   │       ├── time.js
   │       ├── utility.js
   │       └── video.js
   └── scap_1.7/
       ├── cordova/
       │   └── 2.7.0/
       │       └── cordova.webos.js
       └── cordova-cd/
           ├── configuration.js
           ├── deviceInfo.js
           ├── inputSource.js
           ├── iot.js
           ├── power.js
           ├── security.js
           ├── signage.js
           ├── sound.js
           ├── storage.js
           ├── time.js
           ├── utility.js
           └── video.js
   ```

`public/lib/.gitignore` excludes all `scap_*` directories, so these local
libraries remain available for builds without being committed.
