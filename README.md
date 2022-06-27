# Platform for creating and sharing pixelated animations <br>

Interface <br>
<img src="./examples/interface.png"> <br>
Exported GIF <br>
<img src="./examples/exported.gif">

<h3>Completeness</h3>

Unfortunately, due to personal reasons I couldn't work a lot on the coursework, so it is not fully finished and polished. However, all the core features are there.

<h3>Technologies</h3>

The project is using modular JS on the frontend with Web API. There are no other external libraries used.  For deployment, it will be assembled into a single file and compiled with Babel. 

<h3>Tests</h3>

There are unit-test created with the <b>Mocha</b> framework.

<h3>Cooperation</h3>

Our group CodeUmoja has planned to merge projects together, hence the fork. We prepared the configuration and main files together.

I have also received and made peer reviews ([1](https://github.com/MrSampy/Map-Gen-2D/issues/2), [2](https://github.com/jinworldwildhandsome/graphic_calculator/issues/1), [3](https://github.com/Dimdim28/Tanks.js/issues/2))

<h3>Features, which I find the most interesting. Click the name to see the code.</h3>

[Canvas and frames](https://github.com/MytsV/pixel-toons-editor/tree/dev/public/scripts/core/canvas.js) <br>
I tried hard to separate visual representation from logic. There are caching, implementations of Prototype and Memento patterns, high encapsulation and interesting structures.

[Tools](https://github.com/MytsV/pixel-toons-editor/tree/dev/public/scripts/core/tools.js) <br>
I created an abstraction which allows a very easy implementation of new tools.

[BMP encoder](https://github.com/MytsV/pixel-toons-editor/tree/dev/public/scripts/utilities/bmp_encoder.js) <br>
My first file format encoder. I used open source specifications to implement it and a not very usual for me way for fighting with magic number and will be excited to hear your opinion on it.

[GIF encoder](https://github.com/MytsV/pixel-toons-editor/tree/dev/public/scripts/utilities/gif_encoder.js) with [LZW compression](https://github.com/MytsV/pixel-toons-editor/tree/dev/public/scripts/utilities/lzw_compression.js) <br>
Carefully refactored to make the hard process of file encoding as understandable as possible. As BMP encoder, includes a link to specifications. 

[Database handling](https://github.com/MytsV/pixel-toons-editor/tree/dev/public/scripts/utilities/database_handler.js) and [Authentication](https://github.com/MytsV/pixel-toons-editor/tree/dev/public/scripts/authentication.js) <br>
Almost the only part using asynchronous programming. Implemented with Firebase. The public key in the files is secure to be shared.

<h3>My proudest work</h3>

[Own file format](https://github.com/MytsV/pixel-toons-editor/tree/dev/public/scripts/utilities/pxt.js) <br>
[Here is the specification
](https://github.com/MytsV/pixel-toons-editor/tree/dev/examples/Structure.pdf). The format turned out to be extremely lightweight due to Quite OK algorithm chosen for compression. Credits are in the file!
