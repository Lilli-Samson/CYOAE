grammar cyoae;

start_: rich_text_ ws_? EOF;
rich_text_: (plain_text_ | tag_ | code_ | number_)*;
plain_text_: (escaped_text_ | word_ | ws_)+;
attribute_: '{' ws_? attribute_name=word_ ws_? attribute_value=rich_text_ ws_? '}';
tag_: '[' ws_? tag_name=word_ ws_? default_value=rich_text_ (attribute=attribute_ ws_?)* ']';
escaped_text_: '\\\\' | '\\[' | '\\]' | '\\{' | '\\}';
code_: '{' ws_? statement_* ws_? expression_ ws_? '}';
identifier_: WORDCHARACTER (WORDCHARACTER | NUMBER)*;
expression_:
    '(' ws_? expression_ ws_? ')'
    | identifier=identifier_
    | number=number_
    | left_expression=expression_ ws_? operator=('*' | '/') ws_? right_expression=expression_
    | left_expression=expression_ ws_? operator=('+' | '-') ws_? right_expression=expression_
    | identifier=identifier_ ws_? operator='=' ws_? expression=expression_
    ;
statement_: expression=expression_ ';';
ws_: WS;
word_: (WORDCHARACTER | '+'|'-'|'*'|'/'|'='|'('|')'|';')+; //making +-*/=(); explicit should not be necessary, but somehow negation does not match these characters
number_: ('+'|'-')? NUMBER;

//lexer grammar cyoa;
NUMBER: [0-9]+;
WORDCHARACTER: ~('\\'|'['|']'|'{'|'}'|' '|'\t'|'\r'|'\n');
WS: (' '|'\t'|'\r'|'\n')+;
