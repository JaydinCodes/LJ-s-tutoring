const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(...segments) {
  return fs.readFileSync(path.join(root, ...segments), 'utf8');
}

test('assignment upload uses premium drag-and-drop instead of a basic file input', () => {
  const source = read('src', 'features', 'students', 'StudentDashboardComponents.tsx');

  assert.ok(source.includes("import { useDropzone"), 'upload panel must use react-dropzone');
  assert.ok(source.includes('getRootProps'), 'dropzone root props must be rendered');
  assert.ok(source.includes('getInputProps'), 'dropzone input props must be rendered');
  assert.ok(source.includes("Drag your file into this dropzone"), 'dropzone must explain drag-and-drop behavior');
  assert.ok(source.includes('Choose file'), 'dropzone must keep a click-based fallback');
  assert.ok(!source.includes('type="file"'), 'visible basic file input must not be used directly');
});

test('assignment upload validates file type and size before the API call', () => {
  const source = read('src', 'features', 'students', 'StudentDashboardComponents.tsx');

  assert.ok(source.includes('const maxUploadBytes = 10 * 1024 * 1024'), 'max file size must be enforced client-side');
  assert.ok(source.includes("'application/pdf': ['.pdf']"), 'PDF files must be accepted');
  assert.ok(source.includes("'image/jpeg': ['.jpg', '.jpeg']"), 'JPG files must be accepted');
  assert.ok(source.includes("'image/png': ['.png']"), 'PNG files must be accepted');
  assert.ok(source.includes('onDropRejected'), 'dropzone rejections must surface validation errors before submit');
  assert.ok(source.includes('getClientFileError(file)'), 'submit must re-check selected file before API call');
  assert.ok(source.includes('if (fileError || clientFileError || validation)'), 'validation must short-circuit before mutateAsync');
});

test('assignment upload shows preview, progress state, and toast feedback', () => {
  const source = read('src', 'features', 'students', 'StudentDashboardComponents.tsx');
  const app = read('src', 'app', 'App.tsx');

  assert.ok(app.includes("import { Toaster } from 'sonner'"), 'app must mount sonner toaster');
  assert.ok(app.includes('<Toaster position="top-right" richColors />'), 'toaster host must be rendered');
  assert.ok(source.includes("import { toast } from 'sonner'"), 'upload panel must use toast feedback');
  assert.ok(source.includes('function FilePreview'), 'selected file preview must be rendered before upload');
  assert.ok(source.includes('URL.createObjectURL(file)'), 'image files must get a preview URL');
  assert.ok(source.includes('Uploading assignment...'), 'busy upload state must be visible');
  assert.ok(source.includes('toast.success'), 'successful upload must show toast feedback');
  assert.ok(source.includes('toast.error'), 'failed upload and validation errors must show toast feedback');
});
