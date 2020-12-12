grammar cyoae;

start: (text | tag)*;
text: (escaped_text | WORD | WS | '=')+;
tag: '[' WS? tag_name  WS? value? WS? (attribute '=' value WS?)* ']';
tag_name: WORD;
attribute: WORD;
value: (WS* (escaped_text | WORD))+;
escaped_text: '\\\\' | '\\[' | '\\]' | '\\=';

//lexer grammar cyoa;

WORD: ~('='|'\\'|'['|']'|[\p{White_Space}])+;
WS: [\p{White_Space}]+;
