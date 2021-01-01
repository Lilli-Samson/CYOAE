# CYOAE
Create Your Own Adventure Engine

The engine takes text files as input. These text files will be rendered and shown.

## Tags
You can use tags to add logic besides text. Example: `This is a picture: [img https://www.example.com/picture.jpg]`
The tags will be evaluated and executed. The tag name is not case sensitive, so `[img]` and `[IMg]` both do the same.  The following tags are available:
### [img url] or [image url]
Inserts an image specified by the `url`. Example: `[img https://pbs.twimg.com/media/DRBNCH9UIAE_XJz.jpg:tiny]` will show ![head pat](https://pbs.twimg.com/media/DRBNCH9UIAE_XJz.jpg:tiny).

### [choice scene text]
Adds a choice selection for the given scene with the specified text. The scene should exist as a scene.txt file in the same arc, otherwise it is not available. The text is the text of the choice. Example: `[choice escape Leave the prison]`. This will display an option with title "Leave the prison" and if the user clicks on it it will switch to `escape.txt` in the same arc.

### [Try out the interactive demo!](https://lilli-samson.github.io/CYOAE/)