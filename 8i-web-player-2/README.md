# 8i Web Player 4

Web Player for 8i MPEG-DASH streams (PAT) supporting web-based 3D engines.

https://player4-dev.8i.com

## Changes from original implementation

- Deprecated support for the HVR point cloud format.
- Deprecated support for older browsers not supporting Media Source Extensions.
- Removed support for AFRAME.
- Support for arbitrary frame rates.
- Separation of player logic and implementations

## Not implemented

- [ ] Live playback
- [ ] Head tracking
- [ ] Dynamic lighting
- [ ] Implementations
  - [x] THREE.JS
  - [ ] react-three-fiber (using components)
  - [ ] PlayCanvas
  - [ ] WebGPU

## Known issues

- With adaptive frame rate, the texture on the video might flicker while the frame rate of the video and the mesh are mismatching.
- The video needs to buffer before it can be played back, and the player doesn't implement yet heuristics in order to pause / play the video based on the buffer state.
- Using automated frame rate selection is currently not possible, so `targetFPS` must be always set to a certain value.
- It is only possible to scrub within buffered ranges - otherwise, mesh data is not streamed properly anymore.
- Playback of encrypted video tracks is not supported due to browser restrictions, which prohibit to process textures from encrypred video streams.

## 3rd party software

### Dash.js

This player useses a custom fork of [dash.js](https://cdn.dashjs.org/latest/jsdoc/index.html).

This fork is located at https://github.com/8i/dash.js/tree/eighti-development.

- Adding support for a custom `mesh` track / media type.
- Adding a helper method `src/dash/utils/offsetToSeconds.js` which usses [moment.js](https://github.com/moment/moment) in order to parse offsets containing `P`.

### MP4Box

This player useses a custom fork of [MP4Box.js](https://github.com/gpac/mp4box.js).

This fork is located at https://github.com/8i/mp4box.js.

## Installation and development

### Install Node.js

It is recommended to use [nvm](https://github.com/nvm-sh/nvm) in order to install Node.js.

```bash
$ touch ~/.bashrc
$ curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
$ source ~/.bashrc
$ nvm install
```

In case you should use different versions of Node.js, be sure to use the version specified in `.nvmrc` while developing:

```bash
$ nvm use
```

In order to update Node.js using NVM, execute the following:

```bash
$ nvm install `cat .nvmrc`
# Set the project's Node.js version as default
$ nvm alias default `cat .nvmrc`
```

### Install PNPM package manager

This repository is built using the [pnpm](https://github.com/pnpm/pnpm) package manager. Install it as following:

```bash
$ npm install pnpm -g
```

### Installation of dependencies

_in root dir_

```bash
$ export NODE_OPTIONS=--openssl-legacy-provider
$ pnpm install
```

The change to `NODE_OPTIONS` is related to the `ERR_OSSL_EVP_UNSUPPORTED` error, which is thrown when building the custom dash.js build. See https://stackoverflow.com/questions/69394632/webpack-build-failing-with-err-ossl-evp-unsupported.

## Running development server

```bash
$ pnpm build_player
```

## Running test license server

Provide `http://localhost:3000/license` as license server URL.

```bash
$ pnpm start_clearkey_server
```

## Building for production

```
$ pnpm build_player
```

## Resources

- [Original 8i Web Player](https://github.com/8i/embeddable_webplayer)

# Copyright

Copyright 2018-2024 8i, Inc.

Copyright 2018-2024 Digital Things, Inc.
