const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const swc = require('@swc/core');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const server = read('server/main.js');
const client = read('client/templates/Patients.js');
const clone = value => JSON.parse(JSON.stringify(value));
function fixture(role = 'GVP', field = 'gvpNotes') {
  const actor = { _id: 'author', profile: { role, presidentId: 'president' } };
  const record = { _id: 'patient', presidentId: 'president', gvpIds: ['author'],
    [field]: [{ id: 'note', text: 'Prima', authorId: 'author', createdAt: 'original-date' },
      { id: 'other', text: 'Altrui', authorId: 'other-author' }] };
  let updates = 0, disappear = false;
  const matches = selector => selector._id === record._id && selector.presidentId === record.presidentId
    && (!selector.$or || selector.$or.some(part => Object.entries(part).every(([key, id]) =>
      Array.isArray(record[key]) ? record[key].includes(id) : record[key] === id)))
    && record[field].some(note => note.id === selector[field].$elemMatch.id && note.authorId === selector[field].$elemMatch.authorId);
  const name = field === 'casNotes' ? 'hlc.updatePatientCasNote' : 'hlc.updatePatientNote';
  const start = server.indexOf(`  async "${name}"`);
  const end = server.indexOf('  async "', start + 10);
  const methods = vm.runInNewContext('({' + server.slice(start, end) + '})', {
    Date,
    requireUser(context) { if (!context.userId) throw Error('login-required'); },
    check(value) { assert.equal(typeof value, 'string'); },
    Meteor: { Error: class extends Error {}, users: { findOneAsync: async () => actor } },
    requireFollowUpPatientAccess(user, patient) { if (patient?.followUpEnabled && user.profile.role === 'GVP') throw Error('follow-up-denied'); },
    PatientsCollection: {
      findOneAsync: async selector => matches(selector) ? clone(record) : null,
      updateAsync: async (selector, modifier, options) => {
        updates++;
        if (disappear || !matches(selector)) return 0;
        const filter = options.arrayFilters[0];
        const note = record[field].find(n => n.id === filter['note.id'] && n.authorId === filter['note.authorId']);
        note.text = modifier.$set[field + '.$[note].text'];
        note.updatedAt = modifier.$set[field + '.$[note].updatedAt'];
        return 1;
      }
    }
  });
  return { actor, record, updates: () => updates, disappear: () => { disappear = true; },
    run: (id = 'note', text = '  Dopo  ') => methods[name].call({ userId: 'author' }, 'patient', id, text) };
}
test('GVP e CAS modificano solo testo e data della propria nota', async () => {
  for (const [role, field] of [['GVP', 'gvpNotes'], ['CAS', 'gvpNotes'], ['CAS', 'casNotes'], ['Presidente', 'casNotes']]) {
    const f = fixture(role, field);
    if (role === 'Presidente') f.actor._id = 'president';
    const result = await f.run();
    assert.equal(result.text, 'Dopo');
    assert.equal(f.record[field][0].text, 'Dopo');
    assert.equal(f.record[field][0].authorId, 'author');
    assert.equal(f.record[field][0].createdAt, 'original-date');
    assert.equal(f.record[field][1].text, 'Altrui');
    assert.ok(f.record[field][0].updatedAt instanceof Date);
  }
});
test('nega note altrui, altre organizzazioni, GVP non assegnati e note CAS ai GVP', async () => {
  for (const field of ['gvpNotes', 'casNotes']) {
    const other = fixture('CAS', field);
    await assert.rejects(other.run('other'), /not-authorized/);
    assert.equal(other.updates(), 0);
    const organization = fixture('CAS', field);
    organization.actor.profile.presidentId = 'other-president';
    await assert.rejects(organization.run(), /not-authorized/);
  }
  const unassigned = fixture(); unassigned.record.gvpIds = [];
  await assert.rejects(unassigned.run(), /not-authorized/);
  await assert.rejects(fixture('GVP', 'casNotes').run(), /not-authorized/);
  const followUp = fixture(); followUp.record.followUpEnabled = true;
  await assert.rejects(followUp.run(), /follow-up-denied/);
});
test('rifiuta testo vuoto e note rimosse durante il salvataggio; supporta assegnazione GVP legacy', async () => {
  for (const field of ['gvpNotes', 'casNotes']) {
    const f = fixture('CAS', field);
    await assert.rejects(f.run('note', ' \n '), /note-required/);
    assert.equal(f.updates(), 0);
    f.disappear();
    await assert.rejects(f.run(), /note-not-found/);
  }
  const legacy = fixture(); legacy.record.gvpIds = []; legacy.record.gvpId = 'author';
  assert.equal((await legacy.run()).text, 'Dopo');
});
test('compila server e JSX pazienti', () => {
  for (const source of [server, client]) swc.transformSync(source, {
    swcrc: false, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }
  });
});
test('interfaccia: solo autore può modificare/eliminare, annullamento ed errori conservano il testo', () => {
  const start = client.indexOf('export const PatientNote =');
  const end = client.indexOf('export const DETAIL_SECTIONS', start);
  const code = swc.transformSync(client.slice(start, end), { swcrc: false, module: { type: 'commonjs' },
    jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } } }).code;
  const states = []; let cursor = 0, callback;
  const exports = {};
  vm.runInNewContext(code, { exports, require, Intl, Date,
    getNoteRoleBadgeClass: () => 'badge',
    useState(initial) { const index = cursor++; if (!(index in states)) states[index] = initial;
      return [states[index], value => { states[index] = value; }]; }
  });
  const props = { note: { id: 'note', authorId: 'author', text: 'Prima' }, currentUserId: 'author', defaultRole: 'GVP',
    onSave(note, text, done) { assert.equal(text, 'Dopo'); callback = done; }, onDelete() {} };
  const render = () => { cursor = 0; return exports.PatientNote(props); };
  const all = element => !element || typeof element !== 'object' ? [] : [element, ...[].concat(element.props?.children || []).flat(Infinity).flatMap(all)];
  const button = (tree, label) => all(tree).find(e => e.type === 'button' && e.props.children === label);
  assert.ok(button(render(), 'Elimina'));
  props.currentUserId = 'other'; assert.equal(button(render(), 'Modifica'), undefined); assert.equal(button(render(), 'Elimina'), undefined);
  props.currentUserId = 'author'; button(render(), 'Modifica').props.onClick();
  all(render()).find(e => e.type === 'textarea').props.onChange({target:{value:'Dopo'}});
  button(render(), 'Salva').props.onClick(); assert.ok(callback);
  callback({reason:'Errore rete'});
  assert.equal(all(render()).find(e => e.type === 'textarea').props.value, 'Dopo');
  assert.ok(all(render()).find(e => e.props?.role === 'alert'));
  button(render(), 'Annulla').props.onClick(); assert.ok(button(render(), 'Modifica'));
  assert.equal(props.note.text, 'Prima');
  button(render(), 'Modifica').props.onClick();
  assert.equal(all(render()).find(e => e.type === 'textarea').props.value, 'Prima');
});
