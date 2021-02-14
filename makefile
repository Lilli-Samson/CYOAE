TSC = tsc
TSC_FLAGS = --pretty -p
BROWSERIFY = NODE_PATH=. `npm config get prefix`/bin/browserify
MINIFY = `npm config get prefix`/bin/uglifyjs
ANTLR4 = node_modules/.bin/antlr4ts
ANTLR_FILES = cyoaeLexer.interp cyoaeLexer.ts cyoaeLexer.tokens cyoae.interp cyoaeParser.ts cyoaeListener.ts cyoae.tokens
RM = rm

all: release

release: main_release.js
	cp $< main.js

debug: main_debug.js
	cp $< main.js

main_release.js: main_debug.js
	$(MINIFY) $< -cm > $@

$(ANTLR_FILES) &: cyoae.g4
	$(ANTLR4) $<

CYOAE.js: CYOAE.ts $(ANTLR_FILES)
	$(TSC) $(TSC_FLAGS) .

main_debug.js: CYOAE.js $(ANTLR_FILES)
	$(BROWSERIFY) $< > $@

clean:
	$(RM) CYOAE.js main_release.js main_debug.js main.js $(ANTLR_FILES)