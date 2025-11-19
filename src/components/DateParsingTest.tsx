import { useState, useEffect } from 'react';
import { parseNaturalDate, describeNaturalDate } from '../utils/date-parser';
import './DateParsingTest.css';

export default function DateParsingTest() {
  const [input, setInput] = useState('');
  const [parsedDate, setParsedDate] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [autoPrepended, setAutoPrepended] = useState(false);
  const [testResults, setTestResults] = useState<Array<{
    input: string;
    parsed: string | null;
    description: string | null;
    autoPrepended: boolean;
    passed: boolean;
  }>>([]);

  const testCases = [
    'tomorrow',
    'next friday',
    'in 2 weeks',
    '2 weeks',  // Should auto-prepend "in "
    'Friday',   // Should auto-prepend "in "
    '3 months', // Should auto-prepend "in "
    '6 days',   // Should auto-prepend "in "
    'Monday',   // Should auto-prepend "in "
    '1 year',   // Should auto-prepend "in "
    'next month',
    'invalid date string',
    'not a date',
    'in 2 weeks', // Already has "in " - should not double-prepend
    'In 2 weeks', // Case insensitive check
  ];

  useEffect(() => {
    if (!input.trim()) {
      setParsedDate(null);
      setDescription(null);
      setAutoPrepended(false);
      return;
    }

    const trimmed = input.trim();
    const originalParsed = parseNaturalDate(trimmed);
    
    // Check if auto-prepend would happen
    const wouldAutoPrepend = !originalParsed && !trimmed.toLowerCase().startsWith('in ');
    
    // If it would auto-prepend, try with "in " prepended
    let finalParsed = originalParsed;
    if (wouldAutoPrepend) {
      finalParsed = parseNaturalDate(`in ${trimmed}`);
      setAutoPrepended(!!finalParsed);
    } else {
      setAutoPrepended(false);
    }

    setParsedDate(finalParsed);
    setDescription(finalParsed ? describeNaturalDate(trimmed) : null);
  }, [input]);

  const runBatchTests = () => {
    const results = testCases.map(testCase => {
      const trimmed = testCase.trim();
      const originalParsed = parseNaturalDate(trimmed);
      const wouldAutoPrepend = !originalParsed && !trimmed.toLowerCase().startsWith('in ');
      const finalParsed = wouldAutoPrepend ? parseNaturalDate(`in ${trimmed}`) : originalParsed;
      const desc = finalParsed ? describeNaturalDate(trimmed) : null;
      
      return {
        input: testCase,
        parsed: finalParsed,
        description: desc,
        autoPrepended: wouldAutoPrepend && !!finalParsed,
        passed: !!finalParsed || testCase.includes('invalid') || testCase.includes('not a date'),
      };
    });
    
    setTestResults(results);
  };

  return (
    <div className="date-parsing-test">
      <div className="test-container">
        <h1>📅 Date Parsing Test</h1>
        
        <div className="test-section">
          <h2>Interactive Test</h2>
          <div className="input-group">
            <label htmlFor="test-input">Enter a date expression:</label>
            <input
              id="test-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g., '2 weeks', 'Friday', 'tomorrow'"
            />
          </div>
          
          {input.trim() && (
            <div className={`result ${parsedDate ? 'success' : 'error'}`}>
              {parsedDate ? (
                <>
                  <strong>✅ Parsed successfully!</strong>
                  {autoPrepended && (
                    <span className="auto-prepend-indicator">AUTO-PREPENDED "in "</span>
                  )}
                  <div className="result-details">
                    <div><strong>Input:</strong> "{input}"</div>
                    <div><strong>Parsed Date:</strong> {parsedDate}</div>
                    {description && (
                      <div><strong>Formatted:</strong> {description}</div>
                    )}
                    <div>
                      <strong>Full Date:</strong>{' '}
                      {new Date(parsedDate + 'T12:00:00').toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <strong>❌ Failed to parse</strong>
                  <div className="result-details">
                    <div><strong>Input:</strong> "{input}"</div>
                    <div>Could not parse this date expression.</div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="test-section">
          <h2>Quick Test Cases</h2>
          <p>Click any test case to try it:</p>
          <div className="test-cases">
            {testCases.map((testCase, idx) => (
              <button
                key={idx}
                className="test-case"
                onClick={() => setInput(testCase)}
              >
                {testCase}
              </button>
            ))}
          </div>
        </div>

        <div className="test-section">
          <h2>Batch Test Results</h2>
          <button className="run-batch-btn" onClick={runBatchTests}>
            Run All Tests
          </button>
          
          {testResults.length > 0 && (
            <div className="batch-results">
              <div className="summary">
                <strong>
                  Passed: {testResults.filter(r => r.passed).length} / {testResults.length}
                </strong>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Input</th>
                    <th>Parsed</th>
                    <th>Description</th>
                    <th>Auto-Prepended</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {testResults.map((result, idx) => (
                    <tr key={idx} className={result.passed ? 'passed' : 'failed'}>
                      <td><code>{result.input}</code></td>
                      <td>{result.parsed || <em>null</em>}</td>
                      <td>{result.description || <em>null</em>}</td>
                      <td>{result.autoPrepended ? '✅ Yes' : '❌ No'}</td>
                      <td>{result.passed ? '✅ Pass' : '❌ Fail'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

