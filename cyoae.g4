grammar cyoae;

start_: rich_text_ ws_? EOF;
rich_text_: (plain_text_ | tag_ | evaluated_expression_)*;
plain_text_: (escaped_text_ | word_ | ws_)+;
attribute_: '{' ws_? attribute_name=word_ ws_? attribute_value=rich_text_ ws_? '}';
tag_: '[' ws_? tag_name=word_ ws_? default_value=rich_text_ (attribute=attribute_ ws_?)* ']';
escaped_text_: '\\\\' | '\\[' | '\\]' | '\\{' | '\\}';
evaluated_expression_: '{' ws_? expression=expression_ ws_? '}';
identifier_: word_;
operator: '+' | '-' | '*' | '/' | '=';
expression_:
    '(' ws_? expression_ ws_? ')'
    | identifier=word_
    | identifier=word_ ws_? operator ws_? expression_;
ws_: WS;
word_: (WORDCHARACTER | '+'|'-'|'*'|'/'|'='|'('|')')+; //making +-*/=() explicit should not be necessary, but somehow negation does not match these characters

//lexer grammar cyoa;
WORDCHARACTER: ~('\\'|'['|']'|'{'|'}'|' '|'\t'|'\r'|'\n');
WS: (' '|'\t'|'\r'|'\n')+;
