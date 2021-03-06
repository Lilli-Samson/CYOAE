grammar cyoae;

start_: rich_text_ ws_? EOF;
rich_text_: (plain_text_ | tag_ | evaluated_expression_)*;
plain_text_: (escaped_text_ | word_ | ws_)+;
attribute_name_: word_;
attribute_value_: rich_text_;
default_value_: rich_text_;
attribute_open_: '{';
attribute_close_: '}';
attribute_: attribute_open_ ws_? attribute_name_ ws_? attribute_value_ ws_? attribute_close_;
tag_open_: '[';
tag_close_: ']';
tag_: tag_open_ ws_? tag_name_ ws_? default_value_ (attribute_ ws_?)* tag_close_;
tag_name_: word_;
escaped_text_: '\\\\' | '\\[' | '\\]' | '\\{' | '\\}';
evaluated_expression_: '{' ws_? expression_ ws_? '}';
identifier_: word_;
operator: '+' | '-' | '*' | '/' | '=';
expression_: identifier_ | identifier_ ws_? operator ws_? expression_;
ws_: WS;
word_: (WORDCHARACTER | '+'|'-'|'*'|'/'|'=')+; //making +-*/= explicit should not be necessary, but somehow negation does not match these characters

//lexer grammar cyoa;
WORDCHARACTER: ~('\\'|'['|']'|'{'|'}'|' '|'\t'|'\r'|'\n');
WS: (' '|'\t'|'\r'|'\n')+;
