grammar cyoae;

start_: rich_text=rich_text_ ws_? EOF;
rich_text_: (plain_text_ | tag_ | code_ | number_)*;
plain_text_: (escapes=escaped_text_ | word=word_ | ws=ws_)+;
attribute_name_: WORDCHARACTER+;
attribute_: ATTRIBUTE_OPEN WS? attribute_name=attribute_name_ WS? COLON attribute_value=rich_text_ WS? ATTRIBUTE_CLOSE;
tag_: TAG_OPEN WS? tag_name=word_ WS? default_value=rich_text_ (attribute=attribute_ WS?)* TAG_CLOSE;
escaped_text_: '\\\\' | '\\[' | '\\]' | '\\{' | '\\}';
code_: ATTRIBUTE_OPEN WS? statement_* WS? expression_ WS? ATTRIBUTE_CLOSE;
identifier_: WORDCHARACTER (WORDCHARACTER | NUMBER)*;
expression_:
    WS expression=expression_ WS?
    | '(' expression=expression_ ')'
    | identifier=identifier_
    | number=number_
    | '"' string=string_content_ '"'
    | left_expression=expression_ WS? operator=('*' | '/') WS? right_expression=expression_
    | left_expression=expression_ WS? operator=('+' | '-') WS? right_expression=expression_
    | left_expression=expression_ WS? comparator=comparator_ WS? right_expression=expression_
    | identifier=identifier_ WS? operator='=' WS? expression=expression_
    ;
comparator_: '==' | '!=';
statement_: expression=expression_ ';';
ws_: WS;
word_: (WORDCHARACTER | '+'|'-'|'*'|'/'|'='|'('|')'|';'|'"'|':'|','|'=='|'!=')+; //Need to list all implicit tokens
number_: ('+'|'-')? NUMBER;
string_content_:  (~'"'|'\\"')*;
case_code_: expression_? (',' expression_?)* EOF;

//lexer grammar cyoa;
NUMBER: [0-9]+;
COLON: ':';
ATTRIBUTE_OPEN: '{';
ATTRIBUTE_CLOSE: '}';
TAG_OPEN: '[';
TAG_CLOSE: ']';
WS: (' '|'\t'|'\r'|'\n')+;
WORDCHARACTER: ~('\\');
