import UndoManager from 'client/undo-manager'
import TextOperation from 'ot/text-operation'
import h from 'test/helpers/test-helper'

class Editor {
  constructor (doc) {
    this.doc = doc
    this.undoManager = new UndoManager()
  }

  doEdit (operation, dontCompose) {
    function last (arr) {
      return arr[arr.length - 1]
    }

    const compose = !dontCompose && this.undoManager.undoStack.length > 0 &&
      last(this.undoManager.undoStack).invert(this.doc).shouldBeComposedWith(operation)
    this.undoManager.add(operation.invert(this.doc), compose)
    this.doc = operation.apply(this.doc)
  }

  serverEdit (operation) {
    this.doc = operation.apply(this.doc)
    this.undoManager.transform(operation)
  }
}

test('Test UndoManager', (t) => {
  const editor = new Editor('Looremipsum')
  const undoManager = editor.undoManager

  const doing = (name) => {
    const confirmMethod = undoManager[`is${name}doing`].bind(undoManager)
    const performMethod = undoManager[`perform${name}do`].bind(undoManager)
    return function () {
      t.truthy(!confirmMethod())
      performMethod(operation => {
        t.truthy(confirmMethod())
        editor.doEdit(operation)
      })
      t.truthy(!confirmMethod())
    }
  }

  editor.undo = doing('Un')
  editor.redo = doing('Re')

  t.truthy(!undoManager.canUndo())
  t.truthy(!undoManager.canRedo())
  editor.doEdit(new TextOperation().retain(2)['delete'](1).retain(8))
  t.deepEqual(editor.doc, 'Loremipsum')
  t.truthy(undoManager.canUndo())
  t.truthy(!undoManager.canRedo())
  editor.doEdit(new TextOperation().retain(5).insert(' ').retain(5))
  t.deepEqual(editor.doc, 'Lorem ipsum')
  editor.serverEdit(new TextOperation().retain(6)['delete'](1).insert('I').retain(4))
  t.deepEqual(editor.doc, 'Lorem Ipsum')
  editor.undo()
  t.deepEqual(editor.doc, 'LoremIpsum')
  t.truthy(undoManager.canUndo())
  t.truthy(undoManager.canRedo())
  t.deepEqual(1, undoManager.undoStack.length)
  t.deepEqual(1, undoManager.redoStack.length)
  editor.undo()
  t.truthy(!undoManager.canUndo())
  t.truthy(undoManager.canRedo())
  t.deepEqual(editor.doc, 'LooremIpsum')
  editor.redo()
  t.deepEqual(editor.doc, 'LoremIpsum')
  editor.doEdit(new TextOperation().retain(10).insert('D'))
  t.deepEqual(editor.doc, 'LoremIpsumD')
  t.truthy(!undoManager.canRedo())
  editor.doEdit(new TextOperation().retain(11).insert('o'))
  editor.doEdit(new TextOperation().retain(12).insert('l'))
  editor.undo()
  t.deepEqual(editor.doc, 'LoremIpsum')
  editor.redo()
  t.deepEqual(editor.doc, 'LoremIpsumDol')
  editor.doEdit(new TextOperation().retain(13).insert('o'))
  editor.undo()
  t.deepEqual(editor.doc, 'LoremIpsumDol')
  editor.doEdit(new TextOperation().retain(13).insert('o'))
  editor.doEdit(new TextOperation().retain(14).insert('r'), true)
  editor.undo()
  t.deepEqual(editor.doc, 'LoremIpsumDolo')
  t.truthy(undoManager.canRedo())
  editor.serverEdit(new TextOperation().retain(10)['delete'](4))
  editor.redo()
  t.deepEqual(editor.doc, 'LoremIpsumr')
  editor.undo()
  editor.undo()
  t.deepEqual(editor.doc, 'LooremIpsum')
})

test('Test UndoManager when max items', (t) => {
  let doc = h.randomString(50)
  const undoManager = new UndoManager(42)
  let operation
  for (let i = 0; i < 100; i++) {
    operation = h.randomOperation(doc)
    doc = operation.apply(doc)
    undoManager.add(operation)
  }
  t.deepEqual(undoManager.undoStack.length, 42)
})
