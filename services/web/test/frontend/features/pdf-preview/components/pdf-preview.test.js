import { expect } from 'chai'
import sinon from 'sinon'
import fetchMock from 'fetch-mock'
import { screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import PdfPreview from '../../../../../frontend/js/features/pdf-preview/components/pdf-preview'
import { renderWithEditorContext } from '../../../helpers/render-with-context'
import nock from 'nock'
import {
  corruptPDF,
  defaultFileResponses,
  mockBuildFile,
  mockClearCache,
  mockCompile,
  mockCompileError,
  mockValidationProblems,
  mockValidPdf,
} from '../utils/mock-compile'

const mockDelayed = fn => {
  let _resolve = null
  const delayPromise = new Promise((resolve, reject) => {
    _resolve = resolve
  })
  fn(delayPromise)
  return _resolve
}

const storeAndFireEvent = (key, value) => {
  localStorage.setItem(key, value)
  fireEvent(window, new StorageEvent('storage', { key }))
}

const scope = {
  settings: {
    syntaxValidation: false,
  },
  editor: {
    sharejs_doc: {
      doc_id: 'test-doc',
      getSnapshot: () => 'some doc content',
    },
  },
}

describe('<PdfPreview/>', function () {
  let clock

  beforeEach(function () {
    clock = sinon.useFakeTimers({
      shouldAdvanceTime: true,
      now: Date.now(),
    })
    nock.cleanAll()
  })

  afterEach(function () {
    clock.runAll()
    clock.restore()
    fetchMock.reset()
    localStorage.clear()
    sinon.restore()
  })

  it('renders the PDF preview', async function () {
    mockCompile()
    mockBuildFile()
    mockValidPdf()

    renderWithEditorContext(<PdfPreview />, { scope })

    // wait for "compile on load" to finish
    await screen.findByRole('button', { name: 'Compiling…' })
    await screen.findByRole('button', { name: 'Recompile' })
  })

  it('runs a compile when the Recompile button is pressed', async function () {
    mockCompile()
    mockBuildFile()
    mockValidPdf()

    renderWithEditorContext(<PdfPreview />, { scope })

    // wait for "compile on load" to finish
    await screen.findByRole('button', { name: 'Compiling…' })
    await screen.findByRole('button', { name: 'Recompile' })

    mockValidPdf()

    // press the Recompile button => compile
    const button = screen.getByRole('button', { name: 'Recompile' })
    button.click()
    await screen.findByRole('button', { name: 'Compiling…' })
    await screen.findByRole('button', { name: 'Recompile' })

    expect(fetchMock.calls()).to.have.length(6)
  })

  it('runs a compile on `pdf:recompile` event', async function () {
    mockCompile()
    mockBuildFile()
    mockValidPdf()

    renderWithEditorContext(<PdfPreview />, { scope })

    // wait for "compile on load" to finish
    await screen.findByRole('button', { name: 'Compiling…' })
    await screen.findByRole('button', { name: 'Recompile' })

    mockValidPdf()

    fireEvent(window, new CustomEvent('pdf:recompile'))

    await screen.findByRole('button', { name: 'Compiling…' })
    await screen.findByRole('button', { name: 'Recompile' })

    expect(fetchMock.calls()).to.have.length(6)
  })

  it('does not compile while compiling', async function () {
    mockDelayed(mockCompile)

    renderWithEditorContext(<PdfPreview />, { scope })

    // trigger compiles while "compile on load" is running
    await screen.findByRole('button', { name: 'Compiling…' })
    fireEvent(window, new CustomEvent('pdf:recompile'))

    expect(fetchMock.calls()).to.have.length(1)
  })

  it('disables compile button while compile is running', async function () {
    mockCompile()
    mockBuildFile()
    mockValidPdf()

    renderWithEditorContext(<PdfPreview />, { scope })

    let button = screen.getByRole('button', { name: 'Compiling…' })
    expect(button.hasAttribute('disabled')).to.be.true

    button = await screen.findByRole('button', { name: 'Recompile' })
    expect(button.hasAttribute('disabled')).to.be.false
  })

  it('runs a compile on doc change if autocompile is enabled', async function () {
    mockCompile()
    mockBuildFile()
    mockValidPdf()

    renderWithEditorContext(<PdfPreview />, { scope })

    // wait for "compile on load" to finish
    await screen.findByRole('button', { name: 'Compiling…' })
    await screen.findByRole('button', { name: 'Recompile' })

    // switch on auto compile
    storeAndFireEvent('autocompile_enabled:project123', true)

    mockValidPdf()

    // fire a doc:changed event => compile
    fireEvent(window, new CustomEvent('doc:changed'))
    clock.tick(2000) // AUTO_COMPILE_DEBOUNCE

    await screen.findByRole('button', { name: 'Compiling…' })
    await screen.findByRole('button', { name: 'Recompile' })

    expect(fetchMock.calls()).to.have.length(6)
  })

  it('does not run a compile on doc change if autocompile is disabled', async function () {
    mockCompile()
    mockBuildFile()
    mockValidPdf()

    renderWithEditorContext(<PdfPreview />, { scope })

    // wait for "compile on load" to finish
    await screen.findByRole('button', { name: 'Compiling…' })
    await screen.findByRole('button', { name: 'Recompile' })

    // make sure auto compile is switched off
    storeAndFireEvent('autocompile_enabled:project123', false)

    // fire a doc:changed event => no compile
    fireEvent(window, new CustomEvent('doc:changed'))
    clock.tick(2000) // AUTO_COMPILE_DEBOUNCE
    screen.getByRole('button', { name: 'Recompile' })

    expect(fetchMock.calls()).to.have.length(3)
  })

  it('does not run a compile on doc change if autocompile is blocked by syntax check', async function () {
    mockCompile()
    mockBuildFile()
    mockValidPdf()

    renderWithEditorContext(<PdfPreview />, {
      scope: {
        ...scope,
        'settings.syntaxValidation': true, // enable linting in the editor
        hasLintingError: true, // mock a linting error
      },
    })

    // wait for "compile on load" to finish
    await screen.findByRole('button', { name: 'Compiling…' })
    await screen.findByRole('button', { name: 'Recompile' })

    // switch on auto compile and syntax checking
    storeAndFireEvent('autocompile_enabled:project123', true)
    storeAndFireEvent('stop_on_validation_error:project123', true)

    // fire a doc:changed event => no compile
    fireEvent(window, new CustomEvent('doc:changed'))
    clock.tick(2000) // AUTO_COMPILE_DEBOUNCE
    screen.getByRole('button', { name: 'Recompile' })
    await screen.findByText('Code check failed')

    expect(fetchMock.calls()).to.have.length(3)
  })

  describe('displays error messages', function () {
    const compileErrorStatuses = {
      'clear-cache':
        'Sorry, something went wrong and your project could not be compiled. Please try again in a few moments.',
      'clsi-maintenance':
        'The compile servers are down for maintenance, and will be back shortly.',
      'compile-in-progress':
        'A previous compile is still running. Please wait a minute and try compiling again.',
      exited: 'Server Error',
      failure: 'No PDF',
      generic: 'Server Error',
      'project-too-large': 'Project too large',
      'rate-limited': 'Compile rate limit hit',
      terminated: 'Compilation cancelled',
      timedout: 'Timed out',
      'too-recently-compiled':
        'This project was compiled very recently, so this compile has been skipped.',
      unavailable:
        'Sorry, the compile server for your project was temporarily unavailable. Please try again in a few moments.',
      foo: 'Sorry, something went wrong and your project could not be compiled. Please try again in a few moments.',
    }

    for (const [status, message] of Object.entries(compileErrorStatuses)) {
      it(`displays error message for '${status}' status`, async function () {
        cleanup()
        fetchMock.restore()
        mockCompileError(status)

        renderWithEditorContext(<PdfPreview />, { scope })

        // wait for "compile on load" to finish
        await screen.findByRole('button', { name: 'Compiling…' })
        await screen.findByRole('button', { name: 'Recompile' })

        screen.getByText(message)
      })
    }
  })

  it('displays expandable raw logs', async function () {
    mockCompile()
    mockBuildFile()
    mockValidPdf()

    // pretend that the content is large enough to trigger a "collapse"
    // (in jsdom these values are always zero)
    sinon.stub(HTMLElement.prototype, 'scrollHeight').value(500)
    sinon.stub(HTMLElement.prototype, 'scrollWidth').value(500)

    renderWithEditorContext(<PdfPreview />, { scope })

    // wait for "compile on load" to finish
    await screen.findByRole('button', { name: 'Compiling…' })
    await screen.findByRole('button', { name: 'Recompile' })

    const logsButton = screen.getByRole('button', { name: 'View logs' })
    logsButton.click()

    await screen.findByRole('button', { name: 'View PDF' })

    // expand the log
    const [expandButton] = screen.getAllByRole('button', { name: 'Expand' })
    expandButton.click()

    // collapse the log
    const [collapseButton] = screen.getAllByRole('button', { name: 'Collapse' })
    collapseButton.click()
  })

  it('displays error messages if there were validation problems', async function () {
    const validationProblems = {
      sizeCheck: {
        resources: [
          { path: 'foo/bar', kbSize: 76221 },
          { path: 'bar/baz', kbSize: 2342 },
        ],
      },
      mainFile: true,
      conflictedPaths: [
        {
          path: 'foo/bar',
        },
        {
          path: 'foo/baz',
        },
      ],
    }

    mockValidationProblems(validationProblems)

    renderWithEditorContext(<PdfPreview />, { scope })

    // wait for "compile on load" to finish
    await screen.findByRole('button', { name: 'Compiling…' })
    await screen.findByRole('button', { name: 'Recompile' })

    screen.getByText('Project too large')
    screen.getByText('Unknown main document')
    screen.getByText('Conflicting Paths Found')

    expect(fetchMock.called('express:/project/:projectId/compile')).to.be.true // TODO: auto_compile query param
    expect(fetchMock.called('begin:https://clsi.test-overleaf.com/')).to.be
      .false // TODO: actual path
  })

  it('sends a clear cache request when the button is pressed', async function () {
    mockCompile()
    mockBuildFile()
    mockValidPdf()

    renderWithEditorContext(<PdfPreview />, { scope })

    // wait for "compile on load" to finish
    await screen.findByRole('button', { name: 'Compiling…' })
    await screen.findByRole('button', { name: 'Recompile' })

    const logsButton = screen.getByRole('button', {
      name: 'View logs',
    })
    logsButton.click()

    const clearCacheButton = await screen.findByRole('button', {
      name: 'Clear cached files',
    })
    expect(clearCacheButton.hasAttribute('disabled')).to.be.false

    mockClearCache()

    // click the button
    clearCacheButton.click()
    await waitFor(() => {
      expect(clearCacheButton.hasAttribute('disabled')).to.be.true
    })

    await waitFor(() => {
      expect(clearCacheButton.hasAttribute('disabled')).to.be.false
    })

    expect(fetchMock.called('express:/project/:projectId/compile')).to.be.true // TODO: auto_compile query param
    expect(fetchMock.called('begin:https://clsi.test-overleaf.com/')).to.be.true // TODO: actual path
  })

  it('handle "recompile from scratch"', async function () {
    mockCompile()
    mockBuildFile()
    mockValidPdf()

    renderWithEditorContext(<PdfPreview />, { scope })

    // wait for "compile on load" to finish
    await screen.findByRole('button', { name: 'Compiling…' })
    await screen.findByRole('button', { name: 'Recompile' })

    // show the logs UI
    const logsButton = screen.getByRole('button', {
      name: 'View logs',
    })
    logsButton.click()

    const clearCacheButton = await screen.findByRole('button', {
      name: 'Clear cached files',
    })
    expect(clearCacheButton.hasAttribute('disabled')).to.be.false

    mockValidPdf()
    const finishClearCache = mockDelayed(mockClearCache)

    const recompileFromScratch = screen.getByRole('menuitem', {
      name: 'Recompile from scratch',
      hidden: true,
    })
    recompileFromScratch.click()

    await waitFor(() => {
      expect(clearCacheButton.hasAttribute('disabled')).to.be.true
    })

    finishClearCache()

    // wait for compile to finish
    await screen.findByRole('button', { name: 'Compiling…' })
    await screen.findByRole('button', { name: 'Recompile' })

    expect(fetchMock.called('express:/project/:projectId/compile')).to.be.true // TODO: auto_compile query param
    expect(fetchMock.called('express:/project/:projectId/output')).to.be.true
    expect(fetchMock.called('begin:https://clsi.test-overleaf.com/')).to.be.true // TODO: actual path
  })

  it('shows an error for an invalid URL', async function () {
    mockCompile()
    mockBuildFile()

    nock('https://clsi.test-overleaf.com')
      .get(/^\/build\/output.pdf/)
      .replyWithError({
        message: 'something awful happened',
        code: 'AWFUL_ERROR',
      })

    renderWithEditorContext(<PdfPreview />, { scope })

    await screen.findByText('Something went wrong while rendering this PDF.')
    expect(screen.queryByLabelText('Page 1')).to.not.exist

    expect(nock.isDone()).to.be.true
  })

  it('shows an error for a corrupt PDF', async function () {
    mockCompile()
    mockBuildFile()

    nock('https://clsi.test-overleaf.com')
      .get(/^\/build\/output.pdf/)
      .replyWithFile(200, corruptPDF)

    renderWithEditorContext(<PdfPreview />, { scope })

    await screen.findByText('Something went wrong while rendering this PDF.')
    expect(screen.queryByLabelText('Page 1')).to.not.exist

    expect(nock.isDone()).to.be.true
  })

  describe('human readable logs', function () {
    it('shows human readable hint for undefined reference errors', async function () {
      mockCompile()
      mockBuildFile({
        ...defaultFileResponses,
        '/build/output.log': `
log This is pdfTeX, Version 3.14159265-2.6-1.40.21 (TeX Live 2020) (preloaded format=pdflatex 2020.9.10)  8 FEB 2022 16:27
entering extended mode
 \\write18 enabled.
 %&-line parsing enabled.
**main.tex
(./main.tex
LaTeX2e <2020-02-02> patch level 5

LaTeX Warning: Reference \`intorduction' on page 1 undefined on input line 11.


LaTeX Warning: Reference \`section1' on page 1 undefined on input line 13.

[1

{/usr/local/texlive/2020/texmf-var/fonts/map/pdftex/updmap/pdftex.map}] (/compi
le/output.aux)

LaTeX Warning: There were undefined references.

 )
`,
      })
      mockValidPdf()

      renderWithEditorContext(<PdfPreview />, { scope })

      await screen.findByText(
        "Reference `intorduction' on page 1 undefined on input line 11."
      )
      await screen.findByText(
        "Reference `section1' on page 1 undefined on input line 13."
      )
      await screen.findByText('There were undefined references.')
      const hints = await screen.findAllByText(
        /You have referenced something which has not yet been labelled/
      )
      expect(hints.length).to.equal(3)
    })

    it('idoes not show human readable hint for undefined reference errors', async function () {
      mockCompile()
      mockBuildFile({
        ...defaultFileResponses,
        '/build/output.log': `
Package rerunfilecheck Info: File \`output.out' has not changed.
(rerunfilecheck)             Checksum: 339DB29951BB30436898BC39909EA4FA;11265.

Package rerunfilecheck Warning: File \`output.brf' has changed.
(rerunfilecheck)                Rerun to get bibliographical references right.

Package rerunfilecheck Info: Checksums for \`output.brf':
(rerunfilecheck)             Before: D41D8CD98F00B204E9800998ECF8427E;0
(rerunfilecheck)             After:  DF3260FAD3828D54C5E4E9337E97F7AF;4841.
 )
`,
      })
      mockValidPdf()

      renderWithEditorContext(<PdfPreview />, { scope })

      await screen.findByText(
        /Package rerunfilecheck Warning: File `output.brf' has changed. Rerun to get bibliographical references right./
      )
      expect(
        screen.queryByText(
          /You have referenced something which has not yet been labelled/
        )
      ).to.not.exist
    })
  })
})
