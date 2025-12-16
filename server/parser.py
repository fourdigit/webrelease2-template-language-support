"""
WebRelease Template Language Parser - Version 3
Added list element function call validation
"""

import re
from typing import List, Dict, Tuple, Optional, Any, Set
from dataclasses import dataclass
from enum import Enum


class TokenType(Enum):
    """Token types for WebRelease template language"""
    TEXT = "TEXT"
    PERCENT = "PERCENT"
    TAG_OPEN = "TAG_OPEN"
    TAG_CLOSE = "TAG_CLOSE"
    TAG_NAME = "TAG_NAME"
    ATTRIBUTE_NAME = "ATTRIBUTE_NAME"
    ATTRIBUTE_VALUE = "ATTRIBUTE_VALUE"
    IDENTIFIER = "IDENTIFIER"
    NUMBER = "NUMBER"
    STRING = "STRING"
    OPERATOR = "OPERATOR"
    LPAREN = "LPAREN"
    RPAREN = "RPAREN"
    LBRACKET = "LBRACKET"
    RBRACKET = "RBRACKET"
    DOT = "DOT"
    COMMA = "COMMA"
    EOF = "EOF"
    ERROR = "ERROR"


@dataclass
class Token:
    """Represents a token in the template"""
    type: TokenType
    value: str
    line: int
    column: int
    length: int


@dataclass
class Position:
    """Represents a position in the document"""
    line: int
    character: int


@dataclass
class Range:
    """Represents a range in the document"""
    start: Position
    end: Position


@dataclass
class Diagnostic:
    """Represents a diagnostic message"""
    range: Range
    severity: int  # 1=Error, 2=Warning, 3=Information, 4=Hint
    message: str
    code: Optional[str] = None


class ExpressionParser:
    """Parses WebRelease expressions"""
    
    # Built-in functions
    BUILT_IN_FUNCTIONS = {
        'pageTitle', 'currentTime', 'formatDate', 'isNull', 'isNotNull', 'isNumber',
        'number', 'string', 'divide', 'setScale', 'length', 'substring', 'indexOf',
        'contains', 'startsWith', 'endsWith', 'toUpperCase', 'toLowerCase', 'trim',
        'replace', 'split', 'join', 'round', 'floor', 'ceil', 'abs', 'min', 'max',
        'unsplit', 'generatePrice', 'generateBenefit', 'generateBakuage'
    }
    
    # Operators
    OPERATORS = {
        '==', '!=', '<', '<=', '>', '>=', '&&', '||', '!',
        '+', '-', '*', '/', '%'
    }
    
    # Functions that can only be called on single elements (not lists)
    SINGLE_ELEMENT_FUNCTIONS = {
        'selectedValue', 'selectedName', 'selected'
    }
    
    def __init__(self, expression: str, list_elements: Set[str] = None, loop_variables: Set[str] = None):
        self.expression = expression.strip()
        self.pos = 0
        self.list_elements = list_elements or set()
        self.loop_variables = loop_variables or set()
        self.errors: List[Tuple[int, str]] = []  # (position, error_message)
    
    def parse(self) -> Tuple[bool, Optional[str]]:
        """
        Parse expression and return (is_valid, error_message)
        """
        if not self.expression:
            return True, None
        
        try:
            self._parse_expression()
            if self.errors:
                return False, self.errors[0][1]
            return True, None
        except Exception as e:
            return False, str(e)
    
    def get_errors(self) -> List[Tuple[int, str]]:
        """Get all errors found during parsing"""
        return self.errors
    
    def _parse_expression(self):
        """Parse a complete expression"""
        self._parse_or_expression()
    
    def _parse_or_expression(self):
        """Parse logical OR expression"""
        self._parse_and_expression()
        while self._match_operator('||'):
            self._parse_and_expression()
    
    def _parse_and_expression(self):
        """Parse logical AND expression"""
        self._parse_comparison_expression()
        while self._match_operator('&&'):
            self._parse_comparison_expression()
    
    def _parse_comparison_expression(self):
        """Parse comparison expression"""
        self._parse_additive_expression()
        while self._match_any_operator(['==', '!=', '<', '<=', '>', '>=']):
            self._parse_additive_expression()
    
    def _parse_additive_expression(self):
        """Parse addition/subtraction expression"""
        self._parse_multiplicative_expression()
        while self._match_any_operator(['+', '-']):
            self._parse_multiplicative_expression()
    
    def _parse_multiplicative_expression(self):
        """Parse multiplication/division expression"""
        self._parse_unary_expression()
        while self._match_any_operator(['*', '/', '%']):
            self._parse_unary_expression()
    
    def _parse_unary_expression(self):
        """Parse unary expression"""
        if self._match_operator('!'):
            self._parse_unary_expression()
        else:
            self._parse_postfix_expression()
    
    def _parse_postfix_expression(self):
        """Parse postfix expression (function calls, array access, member access)"""
        base_element = self._parse_primary_expression()
        element_chain = [base_element] if base_element else []
        
        while True:
            if self._match('('):
                # Function call
                func_name = element_chain[-1] if element_chain else None
                self._parse_function_arguments()
                self._expect(')')
                
                # Check if this is a single-element function called on a list
                if func_name and func_name in self.SINGLE_ELEMENT_FUNCTIONS:
                    # Build the full element path (excluding the function name)
                    if len(element_chain) > 1:
                        element_path = '.'.join(element_chain[:-1])
                        # Check if any part of the path is a list element
                        self._check_list_function_call(element_path, func_name)
                
                element_chain = []  # Reset after function call
                
            elif self._match('['):
                # Array access
                self._parse_expression()
                self._expect(']')
                element_chain = []  # Array access produces a single element
                
            elif self._match('.'):
                # Member access
                member = self._parse_identifier()
                if member:
                    element_chain.append(member)
            else:
                break
        
        return element_chain
    
    def _check_list_function_call(self, element_path: str, func_name: str):
        """Check if a single-element function is being called on a list element"""
        # Check if the element path itself is a list element
        if element_path in self.list_elements:
            error_pos = self.pos
            self.errors.append((
                error_pos,
                f"Cannot call '{func_name}()' on list element '{element_path}'. "
                f"Use a loop variable instead."
            ))
            return
        
        # Check if any prefix of the path is a list element followed by more path
        parts = element_path.split('.')
        for i in range(len(parts)):
            prefix = '.'.join(parts[:i+1])
            if prefix in self.list_elements:
                # This is a list element, but there's more path after it
                # This means we're accessing a property of a list, which is invalid
                error_pos = self.pos
                self.errors.append((
                    error_pos,
                    f"Cannot call '{func_name}()' on list element '{prefix}'. "
                    f"Use a loop variable to iterate over the list first."
                ))
                return
    
    def _parse_primary_expression(self) -> Optional[str]:
        """Parse primary expression and return the identifier if any"""
        self._skip_whitespace()
        
        if self.pos >= len(self.expression):
            raise ValueError("Unexpected end of expression")
        
        # String literal
        if self.expression[self.pos] == '"':
            self._parse_string_literal()
            return None
        # Number literal
        elif self.expression[self.pos].isdigit():
            self._parse_number_literal()
            return None
        # Parenthesized expression
        elif self.expression[self.pos] == '(':
            self._match('(')
            self._parse_expression()
            self._expect(')')
            return None
        # Identifier (element reference or function call)
        else:
            return self._parse_identifier()
    
    def _parse_identifier(self) -> Optional[str]:
        """Parse identifier"""
        self._skip_whitespace()
        
        if self.pos >= len(self.expression) or not (self.expression[self.pos].isalnum() or self.expression[self.pos] in '_'):
            raise ValueError(f"Expected identifier at position {self.pos}")
        
        start = self.pos
        while self.pos < len(self.expression) and (self.expression[self.pos].isalnum() or self.expression[self.pos] in '_'):
            self.pos += 1
        
        identifier = self.expression[start:self.pos]
        return identifier
    
    def _parse_function_arguments(self):
        """Parse function arguments"""
        self._skip_whitespace()
        
        if self.pos < len(self.expression) and self.expression[self.pos] != ')':
            self._parse_expression()
            
            while self._match(','):
                self._parse_expression()
    
    def _parse_string_literal(self):
        """Parse string literal"""
        self._expect('"')
        
        while self.pos < len(self.expression) and self.expression[self.pos] != '"':
            if self.expression[self.pos] == '\\' and self.pos + 1 < len(self.expression):
                self.pos += 2  # Skip escaped character
            else:
                self.pos += 1
        
        self._expect('"')
    
    def _parse_number_literal(self):
        """Parse number literal"""
        while self.pos < len(self.expression) and (self.expression[self.pos].isdigit() or self.expression[self.pos] == '.'):
            self.pos += 1
    
    def _match(self, ch: str) -> bool:
        """Match a single character"""
        self._skip_whitespace()
        if self.pos < len(self.expression) and self.expression[self.pos] == ch:
            self.pos += 1
            return True
        return False
    
    def _match_operator(self, op: str) -> bool:
        """Match an operator"""
        self._skip_whitespace()
        if self.pos < len(self.expression) and self.expression[self.pos:self.pos+len(op)] == op:
            self.pos += len(op)
            return True
        return False
    
    def _match_any_operator(self, ops: List[str]) -> bool:
        """Match any of the given operators"""
        for op in sorted(ops, key=len, reverse=True):  # Match longest first
            if self._match_operator(op):
                return True
        return False
    
    def _expect(self, ch: str):
        """Expect a character"""
        self._skip_whitespace()
        if self.pos >= len(self.expression) or self.expression[self.pos] != ch:
            raise ValueError(f"Expected '{ch}' at position {self.pos}")
        self.pos += 1
    
    def _skip_whitespace(self):
        """Skip whitespace"""
        while self.pos < len(self.expression) and self.expression[self.pos].isspace():
            self.pos += 1


class TemplateParser:
    """Main parser for WebRelease templates"""
    
    # Valid WebRelease tags
    VALID_TAGS = {
        'wr-if', 'wr-then', 'wr-else', 'wr-switch', 'wr-case', 'wr-default',
        'wr-for', 'wr-break', 'wr-variable', 'wr-append', 'wr-clear',
        'wr-return', 'wr-error', 'wr-conditional', 'wr-cond', 'wr-comment'
    }
    
    # Tag attributes
    TAG_ATTRIBUTES = {
        'wr-if': ['condition'],
        'wr-then': [],
        'wr-else': [],
        'wr-switch': ['value'],
        'wr-case': ['value'],
        'wr-default': [],
        'wr-for': ['list', 'string', 'times', 'variable', 'count', 'index'],
        'wr-break': ['condition'],
        'wr-variable': ['name', 'value'],
        'wr-append': ['name', 'value'],
        'wr-clear': ['name'],
        'wr-return': ['value'],
        'wr-error': ['condition', 'message'],
        'wr-conditional': ['condition'],
        'wr-cond': ['condition'],
        'wr-comment': [],
    }
    
    # Tags that don't require closing tags (or have optional closing)
    # These tags can be self-closing or have optional closing tags
    NO_CLOSE_TAGS = {'wr-then', 'wr-else', 'wr-case', 'wr-default', 'wr-variable', 'wr-append', 'wr-clear', 'wr-break', 'wr-return', 'wr-error', 'wr-cond'}
    
    def __init__(self, content: str):
        self.content = content
        self.diagnostics: List[Diagnostic] = []
        self.list_elements: Set[str] = set()  # Elements that are lists (from wr-for list attribute)
        self.loop_variables: Dict[str, str] = {}  # variable name -> list element mapping
    
    def parse(self) -> List[Diagnostic]:
        """Parse the template and return diagnostics"""
        self.diagnostics = []
        self.list_elements = set()
        self.loop_variables = {}
        
        # First pass: collect list elements from wr-for tags
        self._collect_list_elements()
        
        # Find all expressions with list element validation
        self._validate_expressions()
        
        # Find all tags
        self._validate_tags()
        
        # Find all tag closures
        self._validate_tag_closures()
        
        return self.diagnostics
    
    def _collect_list_elements(self):
        """Collect all list elements from wr-for tags"""
        # Find all wr-for tags and extract list attributes
        pattern = r'<wr-for\s+([^>]*)>'
        
        for match in re.finditer(pattern, self.content):
            attributes_str = match.group(1)
            
            # Extract list attribute
            list_match = re.search(r'list=[\'"]([^\'"]+)[\'"]', attributes_str)
            if list_match:
                list_element = list_match.group(1)
                self.list_elements.add(list_element)
            
            # Extract variable attribute (loop variable)
            var_match = re.search(r'variable=[\'"]([^\'"]+)[\'"]', attributes_str)
            if var_match and list_match:
                var_name = var_match.group(1)
                self.loop_variables[var_name] = list_match.group(1)
    
    def _validate_expressions(self):
        """Validate all expressions in the template"""
        # Find all %...% expressions
        pattern = r'%([^%]*)%'
        
        for match in re.finditer(pattern, self.content):
            expression = match.group(1)
            start_pos = match.start()
            
            # Skip %% (escaped percent)
            if expression == '':
                continue
            
            # Parse expression with list element context
            parser = ExpressionParser(
                expression, 
                list_elements=self.list_elements,
                loop_variables=set(self.loop_variables.keys())
            )
            is_valid, error_msg = parser.parse()
            
            if not is_valid:
                line, column = self._get_line_column(start_pos)
                diagnostic = Diagnostic(
                    range=Range(
                        start=Position(line, column),
                        end=Position(line, column + len(expression) + 2)
                    ),
                    severity=1,  # Error
                    message=f"Expression error: {error_msg}",
                    code="expr-error"
                )
                self.diagnostics.append(diagnostic)
            
            # Check for additional errors from the parser
            for error_pos, error_msg in parser.get_errors():
                line, column = self._get_line_column(start_pos)
                diagnostic = Diagnostic(
                    range=Range(
                        start=Position(line, column),
                        end=Position(line, column + len(expression) + 2)
                    ),
                    severity=1,  # Error
                    message=error_msg,
                    code="list-function-error"
                )
                self.diagnostics.append(diagnostic)
    
    def _validate_tags(self):
        """Validate all WebRelease tags"""
        # Find all <wr-...> tags
        pattern = r'<wr-(\w+)([^>]*)>'
        
        for match in re.finditer(pattern, self.content):
            tag_name = 'wr-' + match.group(1)
            attributes_str = match.group(2)
            start_pos = match.start()
            
            if tag_name not in self.VALID_TAGS:
                line, column = self._get_line_column(start_pos)
                diagnostic = Diagnostic(
                    range=Range(
                        start=Position(line, column),
                        end=Position(line, column + len(tag_name) + 2)
                    ),
                    severity=1,  # Error
                    message=f"Unknown tag: {tag_name}",
                    code="unknown-tag"
                )
                self.diagnostics.append(diagnostic)
                continue
            
            # Validate attributes
            self._validate_tag_attributes(tag_name, attributes_str, start_pos)
    
    def _validate_tag_attributes(self, tag_name: str, attributes_str: str, start_pos: int):
        """Validate tag attributes"""
        # Parse attributes - handle nested quotes
        # Match attribute='value' or attribute="value" where value may contain the other quote type
        attr_pattern = r"(\w+)='([^']*)'|(\w+)=\"([^\"]*)\""
        
        found_attrs = set()
        for match in re.finditer(attr_pattern, attributes_str):
            # Handle both single and double quote patterns
            if match.group(1):  # Single quote pattern matched
                attr_name = match.group(1)
                attr_value = match.group(2)
            else:  # Double quote pattern matched
                attr_name = match.group(3)
                attr_value = match.group(4)
            found_attrs.add(attr_name)
            
            # Check if attribute is valid for this tag
            valid_attrs = self.TAG_ATTRIBUTES.get(tag_name, [])
            if attr_name not in valid_attrs:
                line, column = self._get_line_column(start_pos + match.start())
                diagnostic = Diagnostic(
                    range=Range(
                        start=Position(line, column),
                        end=Position(line, column + len(attr_name))
                    ),
                    severity=2,  # Warning
                    message=f"Unknown attribute '{attr_name}' for tag '{tag_name}'",
                    code="unknown-attribute"
                )
                self.diagnostics.append(diagnostic)
            
            # Validate attribute value (if it's a condition or expression)
            if attr_name == 'condition' and attr_value:
                parser = ExpressionParser(
                    attr_value,
                    list_elements=self.list_elements,
                    loop_variables=set(self.loop_variables.keys())
                )
                is_valid, error_msg = parser.parse()
                if not is_valid:
                    line, column = self._get_line_column(start_pos + match.start(2))
                    diagnostic = Diagnostic(
                        range=Range(
                            start=Position(line, column),
                            end=Position(line, column + len(attr_value))
                        ),
                        severity=1,  # Error
                        message=f"Condition syntax error: {error_msg}",
                        code="condition-syntax-error"
                    )
                    self.diagnostics.append(diagnostic)
                
                # Check for list function errors
                for error_pos, error_msg in parser.get_errors():
                    line, column = self._get_line_column(start_pos + match.start(2))
                    diagnostic = Diagnostic(
                        range=Range(
                            start=Position(line, column),
                            end=Position(line, column + len(attr_value))
                        ),
                        severity=1,  # Error
                        message=error_msg,
                        code="list-function-error"
                    )
                    self.diagnostics.append(diagnostic)
    
    def _validate_tag_closures(self):
        """Validate that tags are properly closed"""
        # Find all opening and closing tags with their positions
        open_pattern = r'<wr-(\w+)(?:\s|>)'
        close_pattern = r'</wr-(\w+)>'
        
        # Collect all tag events (open and close) with positions
        events = []
        
        for match in re.finditer(open_pattern, self.content):
            tag_name = 'wr-' + match.group(1)
            events.append(('open', tag_name, match.start()))
        
        for match in re.finditer(close_pattern, self.content):
            tag_name = 'wr-' + match.group(1)
            events.append(('close', tag_name, match.start()))
        
        # Sort events by position
        events.sort(key=lambda x: x[2])
        
        # Stack-based validation processing events in order
        tag_stack = []
        
        for event_type, tag_name, pos in events:
            if event_type == 'open':
                # Don't push tags that don't need closing
                if tag_name not in self.NO_CLOSE_TAGS:
                    tag_stack.append((tag_name, pos))
            else:  # close
                # Skip closing tags that don't need opening
                if tag_name in self.NO_CLOSE_TAGS:
                    continue
                
                # Find matching opening tag in stack (search from top)
                found = False
                for i in range(len(tag_stack) - 1, -1, -1):
                    if tag_stack[i][0] == tag_name:
                        tag_stack.pop(i)
                        found = True
                        break
                
                if not found:
                    line, column = self._get_line_column(pos)
                    diagnostic = Diagnostic(
                        range=Range(
                            start=Position(line, column),
                            end=Position(line, column + len(tag_name) + 3)
                        ),
                        severity=1,  # Error
                        message=f"Closing tag '{tag_name}' without matching opening tag",
                        code="unmatched-closing-tag"
                    )
                    self.diagnostics.append(diagnostic)
        
        # Check for unclosed tags
        for tag_name, start_pos in tag_stack:
            line, column = self._get_line_column(start_pos)
            diagnostic = Diagnostic(
                range=Range(
                    start=Position(line, column),
                    end=Position(line, column + len(tag_name) + 2)
                ),
                severity=1,  # Error
                message=f"Unclosed tag '{tag_name}'",
                code="unclosed-tag"
            )
            self.diagnostics.append(diagnostic)
    
    def _get_line_column(self, pos: int) -> Tuple[int, int]:
        """Get line and column from position"""
        line = 0
        column = 0
        
        for i in range(min(pos, len(self.content))):
            if self.content[i] == '\n':
                line += 1
                column = 0
            else:
                column += 1
        
        return line, column
