grammar cyoae;

token_start: (token_text | token_tag)* EOF;
token_text: (token_escaped_text | WORD | WS | '=')+;
token_tag: '[' WS? token_tag_name  WS? (token_value | token_tag)? WS? (token_attribute '=' (token_value | token_tag) WS?)* ']';
token_tag_name: WORD;
token_attribute: WORD;
token_value: (WS* (token_escaped_text | WORD))+;
token_escaped_text: '\\\\' | '\\[' | '\\]' | '\\=';

//lexer grammar cyoa;

WORD: ~('='|'\\'|'['|']'|[\p{White_Space}])+;
WS: [\p{White_Space}]+;
