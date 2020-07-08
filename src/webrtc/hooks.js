let hooks = {};

const SUPPORTED_HOOKS = [
  "beforeoffer"
];
SUPPORTED_HOOKS.map(name => {
  hooks[name] = [];
})


function hookIterator(fn, peerConnection, next) {
  return fn(peerConnection, next);
}

function hookRunner(hook, runner, peerConnection, cb) {
  let i = 0;
  const functions = hooks[hook];

  function next(err) {
    if (err || i === functions.length) {
      cb(err, peerConnection);
      return;
    }

    const result = runner(functions[i++], peerConnection, next);
  }
  next();
}

function addHook(name, fn) {
  if (typeof name !== 'string') throw new Error("Invalid Hook Type");
  if (typeof fn !== 'function') throw new Error("Invalid Hook Handler");
  if (SUPPORTED_HOOKS.indexOf(name) === -1) {
    throw new Error(`${name} hook not supported`);
  }
  hooks[name].push(fn);
}

module.exports = {
  addHook,
  hookIterator,
  hookRunner
}