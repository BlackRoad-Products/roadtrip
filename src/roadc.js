// RoadC Language Runtime — JavaScript Port
// Lexer + Parser + Interpreter for CloudFlare Workers
// Original: ~/roadc/ (Python) — Ported for agent execution
// Copyright (c) 2025-2026 BlackRoad OS, Inc. All Rights Reserved.

// ═══════════════════════════════════════════════════════════
// TOKEN TYPES
// ═══════════════════════════════════════════════════════════

const T = {
  // Literals
  INTEGER: 'INTEGER', FLOAT: 'FLOAT', STRING: 'STRING', BOOLEAN: 'BOOLEAN', COLOR: 'COLOR',
  // Identifiers
  IDENTIFIER: 'IDENTIFIER',
  // Keywords
  IF: 'IF', ELIF: 'ELIF', ELSE: 'ELSE', FOR: 'FOR', WHILE: 'WHILE',
  BREAK: 'BREAK', CONTINUE: 'CONTINUE', RETURN: 'RETURN',
  LET: 'LET', VAR: 'VAR', CONST: 'CONST', FUN: 'FUN',
  AND: 'AND', OR: 'OR', NOT: 'NOT',
  // 3D
  SPACE: 'SPACE', CUBE: 'CUBE', SPHERE: 'SPHERE', PLANE: 'PLANE', LIGHT: 'LIGHT', CAMERA: 'CAMERA', RENDER: 'RENDER',
  // Operators
  PLUS: 'PLUS', MINUS: 'MINUS', STAR: 'STAR', SLASH: 'SLASH', PERCENT: 'PERCENT', POWER: 'POWER',
  ASSIGN: 'ASSIGN', PLUS_ASSIGN: 'PLUS_ASSIGN', MINUS_ASSIGN: 'MINUS_ASSIGN', STAR_ASSIGN: 'STAR_ASSIGN', SLASH_ASSIGN: 'SLASH_ASSIGN',
  EQ: 'EQ', NE: 'NE', LT: 'LT', GT: 'GT', LE: 'LE', GE: 'GE',
  // Delimiters
  LPAREN: 'LPAREN', RPAREN: 'RPAREN', LBRACKET: 'LBRACKET', RBRACKET: 'RBRACKET', LBRACE: 'LBRACE', RBRACE: 'RBRACE',
  COLON: 'COLON', COMMA: 'COMMA', DOT: 'DOT', ARROW: 'ARROW', DOUBLE_DOT: 'DOUBLE_DOT',
  // Special
  NEWLINE: 'NEWLINE', INDENT: 'INDENT', DEDENT: 'DEDENT', EOF: 'EOF',
};

const KEYWORDS = {
  if: T.IF, elif: T.ELIF, else: T.ELSE, for: T.FOR, while: T.WHILE,
  break: T.BREAK, continue: T.CONTINUE, return: T.RETURN,
  let: T.LET, var: T.VAR, const: T.CONST, fun: T.FUN,
  and: T.AND, or: T.OR, not: T.NOT, true: T.BOOLEAN, false: T.BOOLEAN,
  space: T.SPACE, cube: T.CUBE, sphere: T.SPHERE, plane: T.PLANE, light: T.LIGHT, camera: T.CAMERA, render: T.RENDER,
  in: T.IDENTIFIER, // 'in' is used as keyword in for..in but stored as ident
};

// ═══════════════════════════════════════════════════════════
// LEXER
// ═══════════════════════════════════════════════════════════

function lex(source) {
  const tokens = [];
  let pos = 0, line = 1, col = 1;
  const indentStack = [0];

  function cur() { return pos < source.length ? source[pos] : null; }
  function peek(off = 1) { return pos + off < source.length ? source[pos + off] : null; }
  function adv() { const c = cur(); if (c === '\n') { line++; col = 1; } else { col++; } pos++; return c; }
  function tok(type, value) { return { type, value, line, col }; }

  while (pos < source.length) {
    // Newlines + indentation
    if (cur() === '\n') {
      adv();
      let indent = 0;
      while (cur() && (cur() === ' ' || cur() === '\t')) {
        indent += cur() === '\t' ? 4 : 1; adv();
      }
      if (cur() === '\n' || cur() === '#') continue; // blank/comment line
      if (cur() !== null) {
        if (indent > indentStack[indentStack.length - 1]) {
          indentStack.push(indent);
          tokens.push(tok(T.INDENT, indent));
        } else {
          while (indentStack.length > 1 && indent < indentStack[indentStack.length - 1]) {
            indentStack.pop();
            tokens.push(tok(T.DEDENT, indent));
          }
        }
        tokens.push(tok(T.NEWLINE, '\n'));
      }
      continue;
    }
    // Whitespace
    if (cur() === ' ' || cur() === '\t' || cur() === '\r') { adv(); continue; }
    // Comments
    if (cur() === '#') {
      if (peek() && /[0-9a-fA-F]/.test(peek())) {
        // Color literal
        adv(); let color = '#';
        while (cur() && /[0-9a-fA-F]/.test(cur())) { color += cur(); adv(); }
        tokens.push(tok(T.COLOR, color)); continue;
      }
      while (cur() && cur() !== '\n') adv();
      continue;
    }
    // Numbers
    if (/[0-9]/.test(cur())) {
      let n = '';
      while (cur() && (/[0-9]/.test(cur()) || cur() === '.')) { n += cur(); adv(); }
      if (cur() && (cur() === 'e' || cur() === 'E')) {
        n += cur(); adv();
        if (cur() && (cur() === '+' || cur() === '-')) { n += cur(); adv(); }
        while (cur() && /[0-9]/.test(cur())) { n += cur(); adv(); }
      }
      tokens.push(n.includes('.') || n.includes('e') || n.includes('E')
        ? tok(T.FLOAT, parseFloat(n)) : tok(T.INTEGER, parseInt(n, 10)));
      continue;
    }
    // Strings
    if (cur() === '"' || cur() === "'") {
      const q = cur(); adv(); let s = '';
      while (cur() && cur() !== q) {
        if (cur() === '\\') { adv(); const c = cur(); s += c === 'n' ? '\n' : c === 't' ? '\t' : c === '\\' ? '\\' : c === q ? q : c; adv(); }
        else { s += cur(); adv(); }
      }
      adv(); // closing quote
      tokens.push(tok(T.STRING, s)); continue;
    }
    // Identifiers/keywords
    if (/[a-zA-Z_]/.test(cur())) {
      let id = '';
      while (cur() && /[a-zA-Z0-9_]/.test(cur())) { id += cur(); adv(); }
      const kwType = KEYWORDS[id];
      if (kwType === T.BOOLEAN) tokens.push(tok(T.BOOLEAN, id === 'true'));
      else if (kwType) tokens.push(tok(kwType, id));
      else tokens.push(tok(T.IDENTIFIER, id));
      continue;
    }
    // Multi-char operators
    const c = cur(), n = peek();
    if (c === '-' && n === '>') { adv(); adv(); tokens.push(tok(T.ARROW, '->')); continue; }
    if (c === '.' && n === '.') { adv(); adv(); tokens.push(tok(T.DOUBLE_DOT, '..')); continue; }
    if (c === '*' && n === '*') { adv(); adv(); tokens.push(tok(T.POWER, '**')); continue; }
    if (c === '=' && n === '=') { adv(); adv(); tokens.push(tok(T.EQ, '==')); continue; }
    if (c === '!' && n === '=') { adv(); adv(); tokens.push(tok(T.NE, '!=')); continue; }
    if (c === '<' && n === '=') { adv(); adv(); tokens.push(tok(T.LE, '<=')); continue; }
    if (c === '>' && n === '=') { adv(); adv(); tokens.push(tok(T.GE, '>=')); continue; }
    if (c === '+' && n === '=') { adv(); adv(); tokens.push(tok(T.PLUS_ASSIGN, '+=')); continue; }
    if (c === '-' && n === '=') { adv(); adv(); tokens.push(tok(T.MINUS_ASSIGN, '-=')); continue; }
    if (c === '*' && n === '=') { adv(); adv(); tokens.push(tok(T.STAR_ASSIGN, '*=')); continue; }
    if (c === '/' && n === '=') { adv(); adv(); tokens.push(tok(T.SLASH_ASSIGN, '/=')); continue; }
    // Single char
    const singles = {'+':T.PLUS,'-':T.MINUS,'*':T.STAR,'/':T.SLASH,'%':T.PERCENT,
      '=':T.ASSIGN,'<':T.LT,'>':T.GT,'(':T.LPAREN,')':T.RPAREN,
      '[':T.LBRACKET,']':T.RBRACKET,'{':T.LBRACE,'}':T.RBRACE,
      ':':T.COLON,',':T.COMMA,'.':T.DOT};
    if (singles[c]) { adv(); tokens.push(tok(singles[c], c)); continue; }
    adv(); // skip unknown
  }
  // Remaining dedents
  while (indentStack.length > 1) { indentStack.pop(); tokens.push(tok(T.DEDENT, 0)); }
  tokens.push(tok(T.EOF, null));
  return tokens;
}

// ═══════════════════════════════════════════════════════════
// PARSER — Recursive Descent → AST
// ═══════════════════════════════════════════════════════════

function parse(tokens) {
  let pos = 0;
  function cur() { return tokens[pos] || tokens[tokens.length - 1]; }
  function peek(off = 1) { return tokens[pos + off] || tokens[tokens.length - 1]; }
  function adv() { const t = cur(); if (t.type !== T.EOF) pos++; return t; }
  function expect(type) { const t = cur(); if (t.type !== type) throw new Error(`Expected ${type}, got ${t.type} at ${t.line}:${t.col}`); return adv(); }
  function match(...types) { return types.includes(cur().type); }
  function skipNL() { while (match(T.NEWLINE)) adv(); }

  function parseProgram() {
    const stmts = []; skipNL();
    while (!match(T.EOF)) { const s = parseStatement(); if (s) stmts.push(s); skipNL(); }
    return { type: 'Program', statements: stmts };
  }

  function parseStatement() {
    skipNL();
    if (match(T.FUN)) return parseFunDef();
    if (match(T.LET, T.VAR, T.CONST)) return parseVarDecl();
    if (match(T.IF)) return parseIf();
    if (match(T.FOR)) return parseFor();
    if (match(T.WHILE)) return parseWhile();
    if (match(T.RETURN)) { adv(); const v = match(T.NEWLINE, T.EOF, T.DEDENT) ? null : parseExpr(); return { type: 'Return', value: v }; }
    if (match(T.BREAK)) { adv(); return { type: 'Break' }; }
    if (match(T.CONTINUE)) { adv(); return { type: 'Continue' }; }
    if (match(T.SPACE)) return parseSpace();
    return parseExprOrAssign();
  }

  function parseVarDecl() {
    const kind = adv().type; // LET/VAR/CONST
    const name = expect(T.IDENTIFIER).value;
    let typeAnn = null;
    if (match(T.COLON)) { adv(); typeAnn = adv().value; } // skip type annotation
    let init = null;
    if (match(T.ASSIGN)) { adv(); init = parseExpr(); }
    return { type: 'VarDecl', name, kind, init };
  }

  function parseFunDef() {
    expect(T.FUN);
    const name = expect(T.IDENTIFIER).value;
    expect(T.LPAREN);
    const params = [];
    while (!match(T.RPAREN)) {
      params.push(expect(T.IDENTIFIER).value);
      if (match(T.COLON)) { adv(); adv(); } // skip type
      if (match(T.ASSIGN)) { adv(); parseExpr(); } // skip default
      if (match(T.COMMA)) adv();
    }
    expect(T.RPAREN);
    if (match(T.ARROW)) { adv(); adv(); } // skip return type
    expect(T.COLON); skipNL(); expect(T.INDENT);
    const body = parseBlock();
    expect(T.DEDENT);
    return { type: 'FunDef', name, params, body };
  }

  function parseBlock() {
    const stmts = []; skipNL();
    while (!match(T.DEDENT, T.EOF)) { const s = parseStatement(); if (s) stmts.push(s); skipNL(); }
    return stmts;
  }

  function parseIf() {
    expect(T.IF);
    const cond = parseExpr();
    expect(T.COLON); skipNL(); expect(T.INDENT);
    const then = parseBlock(); expect(T.DEDENT); skipNL();
    const elifs = [];
    while (match(T.ELIF)) { adv(); const ec = parseExpr(); expect(T.COLON); skipNL(); expect(T.INDENT); const eb = parseBlock(); expect(T.DEDENT); skipNL(); elifs.push({ cond: ec, body: eb }); }
    let els = null;
    if (match(T.ELSE)) { adv(); expect(T.COLON); skipNL(); expect(T.INDENT); els = parseBlock(); expect(T.DEDENT); }
    return { type: 'If', cond, then, elifs, els };
  }

  function parseFor() {
    expect(T.FOR);
    const varName = expect(T.IDENTIFIER).value;
    // expect 'in'
    const inTok = expect(T.IDENTIFIER);
    if (inTok.value !== 'in') throw new Error(`Expected 'in' in for loop at ${inTok.line}:${inTok.col}`);
    const iter = parseExpr();
    expect(T.COLON); skipNL(); expect(T.INDENT);
    const body = parseBlock(); expect(T.DEDENT);
    return { type: 'For', varName, iter, body };
  }

  function parseWhile() {
    expect(T.WHILE);
    const cond = parseExpr();
    expect(T.COLON); skipNL(); expect(T.INDENT);
    const body = parseBlock(); expect(T.DEDENT);
    return { type: 'While', cond, body };
  }

  function parseSpace() {
    expect(T.SPACE);
    const name = expect(T.IDENTIFIER).value;
    expect(T.COLON); skipNL(); expect(T.INDENT);
    const objects = [];
    while (!match(T.DEDENT, T.EOF)) {
      skipNL();
      if (match(T.CUBE, T.SPHERE, T.PLANE, T.LIGHT, T.CAMERA)) {
        const objType = adv().value;
        const objName = expect(T.IDENTIFIER).value;
        expect(T.COLON); skipNL(); expect(T.INDENT);
        const props = {};
        while (!match(T.DEDENT, T.EOF)) {
          skipNL();
          if (match(T.IDENTIFIER) || match(T.COLOR)) {
            const pn = adv().value; expect(T.COLON);
            props[pn] = parseExpr(); skipNL();
          } else break;
        }
        expect(T.DEDENT); skipNL();
        objects.push({ type: 'Object3D', objType, name: objName, props });
      } else break;
    }
    expect(T.DEDENT);
    return { type: 'Space', name, objects };
  }

  function parseExprOrAssign() {
    const expr = parseExpr();
    if (match(T.ASSIGN)) { adv(); return { type: 'Assign', target: expr, value: parseExpr() }; }
    if (match(T.PLUS_ASSIGN, T.MINUS_ASSIGN, T.STAR_ASSIGN, T.SLASH_ASSIGN)) {
      const op = adv().value; return { type: 'CompoundAssign', target: expr, op, value: parseExpr() };
    }
    return { type: 'ExprStmt', expr };
  }

  // Expression parsing — operator precedence
  function parseExpr() { return parseOr(); }
  function parseOr() { let l = parseAnd(); while (match(T.OR)) { adv(); l = { type: 'BinOp', op: 'or', left: l, right: parseAnd() }; } return l; }
  function parseAnd() { let l = parseNot(); while (match(T.AND)) { adv(); l = { type: 'BinOp', op: 'and', left: l, right: parseNot() }; } return l; }
  function parseNot() { if (match(T.NOT)) { adv(); return { type: 'UnaryOp', op: 'not', operand: parseNot() }; } return parseCmp(); }
  function parseCmp() {
    let l = parseAdd();
    while (match(T.EQ,T.NE,T.LT,T.GT,T.LE,T.GE) || (match(T.IDENTIFIER) && cur().value === 'in')) {
      const op = adv().value; l = { type: 'BinOp', op, left: l, right: parseAdd() };
    }
    return l;
  }
  function parseAdd() { let l = parseMul(); while (match(T.PLUS, T.MINUS)) { const op = adv().value; l = { type: 'BinOp', op, left: l, right: parseMul() }; } return l; }
  function parseMul() { let l = parsePow(); while (match(T.STAR, T.SLASH, T.PERCENT)) { const op = adv().value; l = { type: 'BinOp', op, left: l, right: parsePow() }; } return l; }
  function parsePow() { let l = parseUnary(); if (match(T.POWER)) { adv(); l = { type: 'BinOp', op: '**', left: l, right: parsePow() }; } return l; }
  function parseUnary() { if (match(T.MINUS)) { adv(); return { type: 'UnaryOp', op: '-', operand: parseUnary() }; } if (match(T.PLUS)) { adv(); return parseUnary(); } return parsePostfix(parsePrimary()); }

  function parsePostfix(expr) {
    while (true) {
      if (match(T.LPAREN)) { adv(); const args = []; while (!match(T.RPAREN)) { args.push(parseExpr()); if (match(T.COMMA)) adv(); } expect(T.RPAREN); expr = { type: 'Call', fn: expr, args }; }
      else if (match(T.DOT)) { adv(); expr = { type: 'Member', obj: expr, prop: expect(T.IDENTIFIER).value }; }
      else if (match(T.LBRACKET)) { adv(); const idx = parseExpr(); expect(T.RBRACKET); expr = { type: 'Index', obj: expr, idx }; }
      else break;
    }
    return expr;
  }

  function parsePrimary() {
    if (match(T.INTEGER)) return { type: 'Int', value: adv().value };
    if (match(T.FLOAT)) return { type: 'Float', value: adv().value };
    if (match(T.STRING)) return { type: 'Str', value: adv().value };
    if (match(T.BOOLEAN)) return { type: 'Bool', value: adv().value };
    if (match(T.COLOR)) return { type: 'Color', value: adv().value };
    if (match(T.LBRACKET)) { adv(); const els = []; while (!match(T.RBRACKET)) { els.push(parseExpr()); if (match(T.COMMA)) adv(); } expect(T.RBRACKET); return { type: 'List', elements: els }; }
    if (match(T.LBRACE)) {
      adv();
      if (match(T.RBRACE)) { adv(); return { type: 'Dict', pairs: [] }; }
      const first = parseExpr();
      if (match(T.COLON)) { adv(); const fv = parseExpr(); const pairs = [[first, fv]]; while (match(T.COMMA)) { adv(); const k = parseExpr(); expect(T.COLON); pairs.push([k, parseExpr()]); } expect(T.RBRACE); return { type: 'Dict', pairs }; }
      const els = [first]; while (match(T.COMMA)) { adv(); els.push(parseExpr()); } expect(T.RBRACE); return { type: 'Set', elements: els };
    }
    if (match(T.LPAREN)) { adv(); if (match(T.RPAREN)) { adv(); return { type: 'Tuple', elements: [] }; } const e = parseExpr(); if (match(T.COMMA)) { const els = [e]; while (match(T.COMMA)) { adv(); if (!match(T.RPAREN)) els.push(parseExpr()); } expect(T.RPAREN); return { type: 'Tuple', elements: els }; } expect(T.RPAREN); return e; }
    if (match(T.IDENTIFIER)) { const name = adv().value; return { type: 'Ident', name }; }
    throw new Error(`Unexpected ${cur().type} "${cur().value}" at ${cur().line}:${cur().col}`);
  }

  return parseProgram();
}

// ═══════════════════════════════════════════════════════════
// INTERPRETER — Tree-walking execution
// ═══════════════════════════════════════════════════════════

const BREAK_SIG = Symbol('break'), CONTINUE_SIG = Symbol('continue'), RETURN_SIG = Symbol('return');

class Environment {
  constructor(parent = null) { this.vars = {}; this.parent = parent; }
  get(name) {
    if (name in this.vars) return this.vars[name];
    if (this.parent) return this.parent.get(name);
    throw new Error(`Undefined variable '${name}'`);
  }
  set(name, value) { this.vars[name] = value; }
  assign(name, value) {
    if (name in this.vars) { this.vars[name] = value; return; }
    if (this.parent) { this.parent.assign(name, value); return; }
    throw new Error(`Undefined variable '${name}'`);
  }
}

function interpret(ast, options = {}) {
  const output = [];
  const scenes = [];
  const deadline = Date.now() + (options.timeout || 5000);
  let iterations = 0;
  let returnValue;

  function check() { if (++iterations > 100000 || Date.now() > deadline) throw new Error('Execution limit reached'); }

  const globalEnv = new Environment();

  // Builtins
  globalEnv.set('print', (...args) => { output.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')); });
  globalEnv.set('len', (a) => a.length !== undefined ? a.length : Object.keys(a).length);
  globalEnv.set('range', (...a) => { const r = []; const [start, end, step] = a.length === 1 ? [0, a[0], 1] : a.length === 2 ? [a[0], a[1], 1] : a; for (let i = start; step > 0 ? i < end : i > end; i += step) { r.push(i); check(); } return r; });
  globalEnv.set('str', (a) => String(a));
  globalEnv.set('int', (a) => parseInt(a));
  globalEnv.set('float', (a) => parseFloat(a));
  globalEnv.set('type', (a) => typeof a);
  globalEnv.set('abs', (a) => Math.abs(a));
  globalEnv.set('min', (...a) => a.length === 1 && Array.isArray(a[0]) ? Math.min(...a[0]) : Math.min(...a));
  globalEnv.set('max', (...a) => a.length === 1 && Array.isArray(a[0]) ? Math.max(...a[0]) : Math.max(...a));
  globalEnv.set('sum', (a) => a.reduce((s, v) => s + v, 0));
  globalEnv.set('sorted', (a) => [...a].sort((x, y) => x - y));
  globalEnv.set('reversed', (a) => [...a].reverse());
  globalEnv.set('round', (a, d = 0) => { const f = 10 ** d; return Math.round(a * f) / f; });
  globalEnv.set('enumerate', (a) => a.map((v, i) => [i, v]));
  globalEnv.set('zip', (...a) => a[0].map((_, i) => a.map(arr => arr[i])));
  globalEnv.set('map', (fn, arr) => arr.map(fn));
  globalEnv.set('filter', (fn, arr) => arr.filter(fn));
  globalEnv.set('list', (a) => Array.isArray(a) ? [...a] : [...a]);
  globalEnv.set('Math', Math);

  // ─── Vectors ───
  globalEnv.set('vec2', (x, y) => ({ x, y, type: 'vec2' }));
  globalEnv.set('vec3', (x, y, z) => ({ x, y, z, type: 'vec3' }));
  globalEnv.set('vec4', (x, y, z, w) => ({ x, y, z, w, type: 'vec4' }));

  // ─── Math builtins ───
  globalEnv.set('sqrt', Math.sqrt);
  globalEnv.set('sin', Math.sin);
  globalEnv.set('cos', Math.cos);
  globalEnv.set('tan', Math.tan);
  globalEnv.set('atan2', Math.atan2);
  globalEnv.set('floor', Math.floor);
  globalEnv.set('ceil', Math.ceil);
  globalEnv.set('pow', Math.pow);
  globalEnv.set('log', Math.log);
  globalEnv.set('log10', Math.log10);
  globalEnv.set('PI', Math.PI);
  globalEnv.set('E', Math.E);
  globalEnv.set('random', (lo = 0, hi = 1) => lo + Math.random() * (hi - lo));
  globalEnv.set('clamp', (v, lo, hi) => Math.max(lo, Math.min(hi, v)));

  // ─── Physics / Vector math ───
  globalEnv.set('distance', (a, b) => {
    const dx = (a.x||0) - (b.x||0), dy = (a.y||0) - (b.y||0), dz = (a.z||0) - (b.z||0);
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
  });
  globalEnv.set('normalize', (v) => {
    const len = Math.sqrt((v.x||0)**2 + (v.y||0)**2 + (v.z||0)**2) || 1;
    return { x: (v.x||0)/len, y: (v.y||0)/len, z: (v.z||0)/len, type: v.type || 'vec3' };
  });
  globalEnv.set('dot', (a, b) => (a.x||0)*(b.x||0) + (a.y||0)*(b.y||0) + (a.z||0)*(b.z||0));
  globalEnv.set('cross', (a, b) => ({
    x: (a.y||0)*(b.z||0) - (a.z||0)*(b.y||0),
    y: (a.z||0)*(b.x||0) - (a.x||0)*(b.z||0),
    z: (a.x||0)*(b.y||0) - (a.y||0)*(b.x||0), type: 'vec3'
  }));
  globalEnv.set('magnitude', (v) => Math.sqrt((v.x||0)**2 + (v.y||0)**2 + (v.z||0)**2));
  globalEnv.set('lerp', (a, b, t) => {
    if (typeof a === 'number') return a + (b - a) * t;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: (a.z||0) + ((b.z||0) - (a.z||0)) * t, type: a.type || 'vec3' };
  });

  // ─── String/Array extras ───
  globalEnv.set('slice', (obj, start, end) => {
    if (typeof obj === 'string' || Array.isArray(obj)) return obj.slice(start, end);
    throw new Error('slice requires string or array');
  });
  globalEnv.set('join', (arr, sep = '') => arr.join(sep));
  globalEnv.set('split', (s, sep = ' ') => s.split(sep));
  globalEnv.set('replace', (s, old, nw) => s.split(old).join(nw));
  globalEnv.set('find', (haystack, needle) => {
    if (typeof haystack === 'string') return haystack.indexOf(needle);
    if (Array.isArray(haystack)) return haystack.indexOf(needle);
    return -1;
  });
  globalEnv.set('contains', (haystack, needle) => {
    if (typeof haystack === 'string') return haystack.includes(needle);
    if (Array.isArray(haystack)) return haystack.includes(needle);
    if (typeof haystack === 'object' && haystack !== null) return needle in haystack;
    return false;
  });
  globalEnv.set('keys', (obj) => Object.keys(obj));
  globalEnv.set('values', (obj) => Object.values(obj));
  globalEnv.set('items', (obj) => Object.entries(obj));
  globalEnv.set('chr', (n) => String.fromCharCode(n));
  globalEnv.set('ord', (s) => s.charCodeAt(0));
  globalEnv.set('hex', (n) => '0x' + n.toString(16));
  globalEnv.set('bin', (n) => '0b' + n.toString(2));
  globalEnv.set('bool', (v) => !!v);

  // ─── Ternary system (BlackBox Protocol) ───
  const _routes = {};
  globalEnv.set('trit', (v = 0) => ({ value: v < 0 ? -1 : v > 0 ? 1 : 0, type: 'trit', toString() { return v < 0 ? 'CANCELLED(-1)' : v > 0 ? 'ARRIVED(1)' : 'WAITING(0)'; } }));
  globalEnv.set('ARRIVED', { value: 1, type: 'trit' });
  globalEnv.set('WAITING', { value: 0, type: 'trit' });
  globalEnv.set('CANCELLED', { value: -1, type: 'trit' });
  globalEnv.set('tword', (val = 0, width = 8) => {
    // Convert to balanced ternary
    const trits = [];
    let v = Math.abs(val);
    for (let i = 0; i < width; i++) { const r = v % 3; trits.push(r === 2 ? -1 : r); v = r === 2 ? Math.floor(v/3) + 1 : Math.floor(v/3); }
    if (val < 0) trits.forEach((t, i) => trits[i] = -t);
    return { trits, value: val, width, type: 'tword', toString() { return trits.map(t => t < 0 ? 'T' : t > 0 ? '1' : '0').reverse().join(''); } };
  });
  globalEnv.set('route', (id, paths) => {
    _routes[id] = { paths: paths.map(p => ({ name: p, status: 'waiting', result: null })), resolved: false };
    return _routes[id];
  });
  globalEnv.set('resolve', (routeId, pathName, result = null) => {
    const r = _routes[routeId];
    if (!r || r.resolved) return null;
    const path = r.paths.find(p => p.name === pathName);
    if (!path) return null;
    path.status = 'arrived'; path.result = result; r.resolved = true;
    // Cancel all other paths
    r.paths.forEach(p => { if (p.name !== pathName && p.status === 'waiting') p.status = 'cancelled'; });
    return result;
  });
  globalEnv.set('route_status', () => {
    const stats = { total: 0, resolved: 0, pending: 0 };
    for (const [, r] of Object.entries(_routes)) { stats.total++; if (r.resolved) stats.resolved++; else stats.pending++; }
    return stats;
  });

  // ─── 3D render ───
  globalEnv.set('render', (scene, opts) => {
    output.push(`[RENDER] Scene "${scene?.name || 'unnamed'}" — ${scene?.objects?.length || 0} objects`);
    return { rendered: true, objects: scene?.objects?.length || 0 };
  });

  // ─── Time (simulated in Worker) ───
  const _startTime = Date.now();
  globalEnv.set('time', {
    now: () => Date.now(),
    deltaTime: () => 0.016, // ~60fps simulated
    elapsed: () => (Date.now() - _startTime) / 1000,
    sleep: () => null, // no-op in Worker
  });

  // ─── 'in' operator support — add to binary ops ───

  function exec(node, env) {
    check();
    if (!node) return;
    switch (node.type) {
      case 'VarDecl': env.set(node.name, node.init ? evalExpr(node.init, env) : null); break;
      case 'FunDef': env.set(node.name, { ...node, _closure: env }); break;
      case 'ExprStmt': evalExpr(node.expr, env); break;
      case 'Assign': {
        const val = evalExpr(node.value, env);
        if (node.target.type === 'Ident') env.assign(node.target.name, val);
        else if (node.target.type === 'Index') { const obj = evalExpr(node.target.obj, env); obj[evalExpr(node.target.idx, env)] = val; }
        else if (node.target.type === 'Member') { const obj = evalExpr(node.target.obj, env); obj[node.target.prop] = val; }
        break;
      }
      case 'CompoundAssign': {
        if (node.target.type === 'Ident') {
          const old = env.get(node.target.name);
          const rhs = evalExpr(node.value, env);
          const ops = { '+=': (a,b) => a+b, '-=': (a,b) => a-b, '*=': (a,b) => a*b, '/=': (a,b) => a/b };
          env.assign(node.target.name, ops[node.op](old, rhs));
        }
        break;
      }
      case 'If': {
        if (evalExpr(node.cond, env)) { execBlock(node.then, env); return; }
        for (const elif of node.elifs) { if (evalExpr(elif.cond, env)) { execBlock(elif.body, env); return; } }
        if (node.els) execBlock(node.els, env);
        break;
      }
      case 'For': {
        const items = evalExpr(node.iter, env);
        for (const item of items) {
          check(); env.set(node.varName, item);
          try { execBlock(node.body, env); } catch (e) { if (e === BREAK_SIG) break; if (e === CONTINUE_SIG) continue; throw e; }
        }
        break;
      }
      case 'While': {
        while (evalExpr(node.cond, env)) {
          check();
          try { execBlock(node.body, env); } catch (e) { if (e === BREAK_SIG) break; if (e === CONTINUE_SIG) continue; throw e; }
        }
        break;
      }
      case 'Return': returnValue = node.value ? evalExpr(node.value, env) : null; throw RETURN_SIG;
      case 'Break': throw BREAK_SIG;
      case 'Continue': throw CONTINUE_SIG;
      case 'Space': {
        const scene = { name: node.name, objects: [] };
        for (const obj of node.objects) {
          const props = {};
          for (const [key, val] of Object.entries(obj.props)) { props[key] = evalExpr(val, env); }
          scene.objects.push({ type: obj.objType, name: obj.name, ...props });
        }
        scenes.push(scene);
        output.push(`[3D Scene "${node.name}": ${node.objects.length} objects]`);
        for (const obj of scene.objects) {
          output.push(`  ${obj.type} "${obj.name}" — ${JSON.stringify(obj)}`);
        }
        break;
      }
    }
  }

  function execBlock(stmts, env) { for (const s of stmts) exec(s, env); }

  function evalExpr(node, env) {
    check();
    switch (node.type) {
      case 'Int': case 'Float': return node.value;
      case 'Str': return interpolateStr(node.value, env);
      case 'Bool': return node.value;
      case 'Color': return node.value;
      case 'Ident': return env.get(node.name);
      case 'List': return node.elements.map(e => evalExpr(e, env));
      case 'Dict': { const d = {}; for (const [k, v] of node.pairs) d[evalExpr(k, env)] = evalExpr(v, env); return d; }
      case 'Set': return new Set(node.elements.map(e => evalExpr(e, env)));
      case 'Tuple': return node.elements.map(e => evalExpr(e, env));
      case 'BinOp': return evalBinOp(node.op, evalExpr(node.left, env), evalExpr(node.right, env));
      case 'UnaryOp': { const v = evalExpr(node.operand, env); return node.op === '-' ? -v : node.op === 'not' ? !v : +v; }
      case 'Call': return evalCall(node, env);
      case 'Member': return evalMember(node, env);
      case 'Index': return evalExpr(node.obj, env)[evalExpr(node.idx, env)];
      default: throw new Error(`Unknown expression: ${node.type}`);
    }
  }

  function evalBinOp(op, l, r) {
    const ops = {
      '+': (a,b) => typeof a === 'string' || typeof b === 'string' ? String(a) + String(b) : a + b,
      '-': (a,b) => a-b, '*': (a,b) => a*b, '/': (a,b) => a/b, '%': (a,b) => a%b, '**': (a,b) => a**b,
      '==': (a,b) => a===b, '!=': (a,b) => a!==b, '<': (a,b) => a<b, '>': (a,b) => a>b, '<=': (a,b) => a<=b, '>=': (a,b) => a>=b,
      'and': (a,b) => a&&b, 'or': (a,b) => a||b,
      'in': (a,b) => {
        if (typeof b === 'string') return b.includes(a);
        if (Array.isArray(b)) return b.includes(a);
        if (b && typeof b === 'object') return a in b;
        return false;
      },
    };
    if (ops[op]) return ops[op](l, r);
    throw new Error(`Unknown operator: ${op}`);
  }

  function interpolateStr(s, env) {
    return s.replace(/\{([^}]+)\}/g, (full, expr) => {
      try {
        // Simple variable
        if (/^\w+$/.test(expr)) return String(env.get(expr));
        // Index access: var[idx]
        const idxMatch = expr.match(/^(\w+)\[(\w+)\]$/);
        if (idxMatch) {
          const obj = env.get(idxMatch[1]);
          const idx = /^\d+$/.test(idxMatch[2]) ? parseInt(idxMatch[2]) : env.get(idxMatch[2]);
          return String(obj[idx]);
        }
        // Member access: var.prop
        const dotMatch = expr.match(/^(\w+)\.(\w+)$/);
        if (dotMatch) {
          const obj = env.get(dotMatch[1]);
          return String(obj[dotMatch[2]]);
        }
        // Arithmetic: var + 1, var - 1
        const arithMatch = expr.match(/^(\w+)\s*([+\-*/])\s*(\d+)$/);
        if (arithMatch) {
          const v = env.get(arithMatch[1]);
          const n = parseInt(arithMatch[3]);
          const ops = {'+': (a,b) => a+b, '-': (a,b) => a-b, '*': (a,b) => a*b, '/': (a,b) => a/b};
          return String(ops[arithMatch[2]](v, n));
        }
        return full;
      } catch { return full; }
    });
  }

  function evalMember(node, env) {
    const obj = evalExpr(node.obj, env);
    const prop = node.prop;
    // String methods
    if (typeof obj === 'string') {
      const methods = { upper: () => obj.toUpperCase(), lower: () => obj.toLowerCase(), split: (s = ' ') => obj.split(s), strip: () => obj.trim(), replace: (a, b) => obj.replace(a, b), startswith: (p) => obj.startsWith(p), endswith: (s) => obj.endsWith(s), contains: (s) => obj.includes(s), length: obj.length };
      if (prop in methods) return typeof methods[prop] === 'function' ? methods[prop] : methods[prop];
    }
    // Array methods
    if (Array.isArray(obj)) {
      const methods = { append: (v) => { obj.push(v); }, pop: () => obj.pop(), length: obj.length, sort: () => { obj.sort((a,b) => a-b); return obj; }, reverse: () => { obj.reverse(); return obj; }, join: (s = ',') => obj.join(s), includes: (v) => obj.includes(v) };
      if (prop in methods) return typeof methods[prop] === 'function' ? methods[prop] : methods[prop];
    }
    // Dict/object
    if (typeof obj === 'object' && obj !== null) {
      if (prop === 'keys') return () => Object.keys(obj);
      if (prop === 'values') return () => Object.values(obj);
      if (prop === 'items') return () => Object.entries(obj);
      if (prop in obj) return obj[prop];
    }
    throw new Error(`'${typeof obj}' has no attribute '${prop}'`);
  }

  function evalCall(node, env) {
    const fn = evalExpr(node.fn, env);
    const args = node.args.map(a => evalExpr(a, env));
    // Native function
    if (typeof fn === 'function') return fn(...args);
    // RoadC function
    if (fn && fn.type === 'FunDef') {
      const callEnv = new Environment(fn._closure || globalEnv);
      fn.params.forEach((p, i) => callEnv.set(p, args[i]));
      try { execBlock(fn.body, callEnv); } catch (e) { if (e === RETURN_SIG) return returnValue; throw e; }
      return null;
    }
    throw new Error(`Not callable: ${JSON.stringify(fn)}`);
  }

  // Execute
  try {
    execBlock(ast.statements, globalEnv);
  } catch (e) {
    if (e === RETURN_SIG) { if (returnValue !== undefined) output.push(String(returnValue)); }
    else return { ok: false, stdout: output.join('\n'), stderr: e.message || String(e), scenes, language: 'roadc' };
  }

  return { ok: true, stdout: output.join('\n'), stderr: '', scenes, language: 'roadc', iterations };
}

// ═══════════════════════════════════════════════════════════
// PUBLIC API — run RoadC code
// ═══════════════════════════════════════════════════════════

function runRoadC(source, options = {}) {
  const startTime = Date.now();
  try {
    const tokens = lex(source);
    const ast = parse(tokens);
    const result = interpret(ast, options);
    result.elapsed_ms = Date.now() - startTime;
    return result;
  } catch (e) {
    return { ok: false, stdout: '', stderr: e.message || String(e), scenes: [], language: 'roadc', elapsed_ms: Date.now() - startTime };
  }
}

export { runRoadC, lex, parse, interpret };
