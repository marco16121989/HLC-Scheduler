const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const swc = require("@swc/core");
const React = require("react");

for (const role of ["CAS", "GVP"]) test(`${role} profile fields are displayed, editable, normalized and retained when reopening`, async () => {
  let users = [
    { id: "p", role: "Presidente", username: "Presidente" },
    { id: "c", role, username: "Member", presidentId: "p", firstName: "Anna", lastName: "Rossi", email: "anna@example.it", phone: "012345" },
  ];
  const state = [];
  let failNextSave = false;
  let cursor = 0;
  const fakeReact = { ...React, useEffect() {}, useRef: () => ({ current: null }), useState(initial) {
    const index = cursor++;
    if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
    return [state[index], (value) => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
  } };
  const root = path.join(__dirname, "..");
  function load(file) {
    if (path.extname(file) === ".json") return JSON.parse(fs.readFileSync(file, "utf8"));
    const mod = { exports: {} };
    const { code } = swc.transformSync(fs.readFileSync(file, "utf8"), { jsc: { parser: { syntax: "ecmascript", jsx: true }, transform: { react: { runtime: "automatic" } } }, module: { type: "commonjs" } });
    new Function("require", "module", "exports", code)((name) => {
      if (name === "react") return fakeReact;
      if (name === "meteor/meteor") return { Meteor: { callAsync: async () => {} } };
      if (name.startsWith("/") || name.startsWith(".")) {
        let target = name.startsWith("/") ? path.join(root, name.slice(1)) : path.resolve(path.dirname(file), name);
        if (!path.extname(target)) target += ".js";
        return load(target);
      }
      return require(name);
    }, mod, mod.exports);
    return mod.exports;
  }
  const { Users } = load(path.join(root, "client/templates/Users.js"));
  function render() {
    cursor = 0;
    const nodes = [];
    function visit(node) {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== "object") return;
      nodes.push(node);
      visit(node.props?.children);
    }
    visit(Users({ users, setUsers: async (update) => {
      if (failNextSave) throw { reason: "Nome utente già in uso." };
      users = update(users);
    }, manager: users[0], managedRole: role }));
    return nodes;
  }
  const memberRow = () => render().find((node) => node.type === "tr" && ["c", "free-c"].includes(node.key));
  const edit = () => memberRow().props.onClick();
  const expected = { firstName: "Maria", lastName: "Bianchi", email: "maria@example.it", phone: "009876" };
  const row = memberRow();
  assert.ok(JSON.stringify(row).includes("012345"));
  assert.ok(!render().some((node) => node.type === "th" && ["Nome", "Cognome", "Email"].includes(node.props.children)));
  edit();
  for (const [name, value] of Object.entries(expected)) {
    const input = render().find((node) => node.props?.id === `user-${name}`);
    assert.equal(input.props.value, users[1][name]);
    input.props.onChange({ target: { name, value: ` ${name === "email" ? value.toUpperCase() : value} ` } });
  }
  failNextSave = true;
  await render().find((node) => node.type === "form").props.onSubmit({ preventDefault() {} });
  assert.ok(render().some((node) => node.props?.role === "alert" && node.props.children === "Nome utente già in uso."));
  assert.equal(render().find((node) => node.props?.id === "user-firstName").props.value, " Maria ");
  assert.equal(users[1].firstName, "Anna");
  failNextSave = false;
  await render().find((node) => node.type === "form").props.onSubmit({ preventDefault() {} });
  for (const [name, value] of Object.entries(expected)) assert.equal(users[1][name], value);
  edit();
  for (const [name, value] of Object.entries(expected)) assert.equal(render().find((node) => node.props?.id === `user-${name}`).props.value, value);
});
