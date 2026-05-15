import { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import ReactMarkdown from 'react-markdown';

// ==========================================
// 1. DATA & PROMPTS (From your uploaded .txt files)
// ==========================================
const MAIN_PROMPT = `You are an AI decision-support assistant built for a Makeathon / UniAI demo.
Your role is to analyze an input case, identify the core problem, propose a practical AI-supported solution, and present the result in a way that is useful for a business-oriented presentation.
You must not present yourself as making an automatic final decision.
Instead, you support human decision-making by organizing information, detecting risks, explaining trade-offs, and recommending next actions.
Analyze the user's input and return a clear, structured response with the following sections:

1. Executive Summary
Provide a short summary of the case in 3-5 sentences.
Explain what the situation is, what problem appears, and what kind of decision support is needed.

2. Problem Detected
Identify the main problem or opportunity. If there are multiple problems, list them in order of importance.
Explain why this problem matters.

3. Stakeholders Affected
Identify who is affected by the problem, such as users, customers, employees, students, citizens, managers, organizations, or public authorities.

4. Priority / Risk Score
Assign a priority or risk score from 1 to 5:
1 = Low priority / low risk
2 = Moderate-low priority / limited risk
3 = Medium priority / relevant risk
4 = High priority / significant risk
5 = Critical priority / urgent risk
Explain clearly why you selected this score.

5. Recommended Action
Propose a practical recommended action. The recommendation should be realistic, useful, and suitable for a prototype or demo.

6. Why this recommendation?
Explain the reasoning behind the recommendation.
Connect the recommendation to the detected problem, the affected stakeholders and the expected value.

7. Why not an automatic final decision?
Explain why the AI should not make a fully automatic final decision.
Mention uncertainty, missing context, ethical considerations, need for human review, or business accountability where relevant.

8. Suggested AI Features
Suggest 3-5 AI features that could be included in a prototype.
Examples may include classification, summarization, prioritization, recommendation, risk scoring, chatbot interaction, document analysis, or report generation.

9. Business Impact
Explain the expected value of the solution. Focus on time savings, better prioritization, improved decision-making, reduced manual work, better user experience, transparency, or scalability.

10. Risks and Limitations
Mention possible weaknesses or risks of the proposed solution, such as biased data, wrong classification, privacy issues, overreliance on AI, lack of explainability, or need for human validation.

11. Next Actions
Give a short implementation-oriented plan with concrete next steps. The steps should be realistic for a Makeathon prototype.

12. Pitch-ready Value Proposition
Write a concise pitch paragraph that could be used in a presentation.
It should explain the problem, the solution, and the value in a clear and convincing way.

Output requirements:
- Use clear headings.
- Be concise but complete.
- Use business-friendly language.
- Avoid overly technical explanations unless necessary.
- Make the answer suitable for a demo presentation.
- If the input is vague, make reasonable assumptions and state them clearly.
- Always focus on practical usefulness, explainability, and human-in-the-loop decision support.
- If the user's input is in Greek, respond in Greek.
- If the user's input is in English, respond in English.`;

const DEMO_CASES = {
  "Business": "Μια μικρομεσαία επιχείρηση δέχεται καθημερινά πολλά μηνύματα από πελάτες μέσω email, φόρμας επικοινωνίας και social media. Τα μηνύματα αφορούν παράπονα, ερωτήσεις για προϊόντα, αιτήματα επιστροφής χρημάτων, τεχνικά προβλήματα και εμπορικές ευκαιρίες. Η ομάδα εξυπηρέτησης χάνει χρόνο προσπαθώντας να καταλάβει ποια αιτήματα είναι πιο σημαντικά και ποιος πρέπει να τα αναλάβει. Η λύση πρέπει να αναλύει τα μηνύματα, να τα κατηγοριοποιεί, να δίνει priority score, να προτείνει επόμενη ενέργεια και να παράγει σύντομη περίληψη για την ομάδα.",
  "Customer Support": "Μια εταιρεία τεχνολογίας δέχεται μεγάλο αριθμό αιτημάτων υποστήριξης από πελάτες. Τα αιτήματα περιλαμβάνουν τεχνικά προβλήματα, ερωτήσεις χρήσης, παράπονα για καθυστερήσεις, ζητήματα λογαριασμού και προτάσεις βελτίωσης. Η ομάδα υποστήριξης δυσκολεύεται να ξεχωρίσει ποια αιτήματα είναι επείγοντα και ποια μπορούν να απαντηθούν αργότερα. Η λύση πρέπει να ταξινομεί τα αιτήματα, να εντοπίζει το συναίσθημα του πελάτη, να δίνει priority score, να προτείνει απάντηση ή επόμενη ενέργεια και να βοηθά την ομάδα να μειώσει τον χρόνο απόκρισης.",
  "Education": "Ένα πανεπιστήμιο θέλει να χρησιμοποιήσει τεχνητή νοημοσύνη για να βοηθά φοιτητές να οργανώνουν καλύτερα το διάβασμά τους. Οι φοιτητές συχνά δυσκολεύονται να καταλάβουν ποιες εργασίες έχουν προτεραιότητα, πότε πρέπει να ξεκινήσουν την προετοιμασία για εξετάσεις και πώς να κατανείμουν τον χρόνο τους ανάμεσα σε μαθήματα, εργασίες και προσωπικές υποχρεώσεις. Η λύση πρέπει να δέχεται ως input τις προθεσμίες, τα μαθήματα, τον διαθέσιμο χρόνο και το επίπεδο δυσκολίας κάθε εργασίας. Στη συνέχεια πρέπει να προτείνει πρόγραμμα μελέτης, να εντοπίζει πιθανούς κινδύνους καθυστέρησης και να δίνει σύντομες εξηγήσεις για τις προτεραιότητες που προτείνει.",
  "Health": "Ένα ιδιωτικό ιατρικό κέντρο θέλει να βελτιώσει τη διαχείριση αιτημάτων ασθενών. Οι ασθενείς στέλνουν μηνύματα για ραντεβού, συμπτώματα, επανεξέταση, αποτελέσματα εξετάσεων και διοικητικά ζητήματα. Το προσωπικό πρέπει να ξεχωρίζει γρήγορα ποια αιτήματα χρειάζονται άμεση προσοχή και ποια μπορούν να προγραμματιστούν αργότερα. Η λύση πρέπει να βοηθά στην κατηγοριοποίηση των αιτημάτων, στην εκτίμηση προτεραιότητας, στη δημιουργία σύντομης περίληψης και στην πρόταση επόμενων ενεργειών. Η τελική απόφαση πρέπει πάντα να παραμένει σε άνθρωπο, ειδικά για ιατρικά ή ευαίσθητα ζητήματα.",
  "Public Sector": "Ένας δήμος θέλει να χρησιμοποιήσει τεχνητή νοημοσύνη για να διαχειρίζεται πιο γρήγορα αιτήματα πολιτών. Οι πολίτες στέλνουν αιτήματα για προβλήματα όπως καμένος φωτισμός, καθαριότητα, φθορές σε δρόμους, παράπονα για δημόσιους χώρους και ανάγκη άμεσης παρέμβασης σε συγκεκριμένες περιοχές. Η λύση πρέπει να ταξινομεί τα αιτήματα, να εντοπίζει ποια είναι πιο επείγοντα, να προτείνει προτεραιότητες στις υπηρεσίες του δήμου και να δημιουργεί σύντομη αναφορά για τους υπαλλήλους.",
  "Sustainability": "Μια εταιρεία θέλει να χρησιμοποιήσει τεχνητή νοημοσύνη για να μειώσει το περιβαλλοντικό της αποτύπωμα. Η εταιρεία έχει δεδομένα για κατανάλωση ενέργειας, μεταφορές, απορρίμματα, προμήθειες και χρήση υλικών. Η διοίκηση θέλει να εντοπίσει περιοχές με υψηλή σπατάλη, να προτεραιοποιήσει δράσεις βιωσιμότητας και να δημιουργήσει αναφορά με πρακτικές προτάσεις. Η λύση πρέπει να αναλύει τα διαθέσιμα στοιχεία, να εντοπίζει βασικά σημεία βελτίωσης, να προτείνει ενέργειες με βάση τον πιθανό αντίκτυπο και να παρουσιάζει τα αποτελέσματα με τρόπο κατανοητό για τη διοίκηση."
};

// ==========================================
// MAIN APP COMPONENT
// ==========================================
export default function App() {
  const [activeTab, setActiveTab] = useState('1️⃣ Input');
  
  const [projectName, setProjectName] = useState('InsightPilot AI');
  const [challengeType, setChallengeType] = useState('Business');
  const [useDemo, setUseDemo] = useState(true);
  const [useAI, setUseAI] = useState(true);
  
  const [inputText, setInputText] = useState(DEMO_CASES['Business']);
  
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState('');
  const [analysisMode, setAnalysisMode] = useState('');

  const [manualMinutes, setManualMinutes] = useState(30);
  const [aiMinutes, setAiMinutes] = useState(5);
  const [casesPerDay, setCasesPerDay] = useState(50);

  useEffect(() => {
    if (useDemo) setInputText(DEMO_CASES[challengeType] || DEMO_CASES['Business']);
  }, [challengeType, useDemo]);

  const analyzeCaseWithRules = (text) => {
    const textLower = text.toLowerCase();
    let riskScore = 50;
    const reasons = [];

    const highRiskKeywords = ["παράπονα", "καθυστερήσεις", "επείγοντα", "κινδύνους", "σπατάλη", "φθορές", "άμεσης", "complaint", "urgent", "risk", "high"];
    const mediumRiskKeywords = ["ερωτήσεις", "δυσκολεύονται", "σύμπτωμα", "ζητήματα", "concern", "slow", "limited"];

    highRiskKeywords.forEach(word => { if (textLower.includes(word)) { riskScore += 7; reasons.push(`Εντοπίστηκε σήμα υψηλής προτεραιότητας: '${word}'`); }});
    mediumRiskKeywords.forEach(word => { if (textLower.includes(word)) { riskScore += 4; reasons.push(`Εντοπίστηκε σήμα μεσαίας προτεραιότητας: '${word}'`); }});

    riskScore = Math.min(riskScore, 100);
    let priority = riskScore >= 75 ? "Υψηλή" : riskScore >= 55 ? "Μεσαία" : "Χαμηλή";
    let recommendation = riskScore >= 75 ? "Άμεση κλιμάκωση και έλεγχος από άνθρωπο." : riskScore >= 55 ? "Προσεκτική εξέταση και συλλογή δεδομένων." : "Κανονική επεξεργασία και παρακολούθηση.";

    if (reasons.length === 0) reasons.push("Δεν εντοπίστηκαν έντονα αρνητικά σήματα.", "Μπορεί να ακολουθηθεί η τυπική διαδικασία.");

    return `## 1. Executive Summary\nΤο σύστημα ανέλυσε τα δεδομένα και τα μετέτρεψε σε δομημένη αναφορά.\n## 2. Problem Detected\nΑπαιτείται ταξινόμηση και ιεράρχηση.\n## 3. Priority / Risk Score\n**${riskScore}/100**\nΕπίπεδο προτεραιότητας: **${priority}**\n## 4. Recommended Action\n**${recommendation}**\n## 5. Why this recommendation?\n${reasons.slice(0, 5).map(r => `- ${r}`).join('\n')}\n## 6. Why not automatic final decision?\nΤο εργαλείο λειτουργεί συμβουλευτικά. Η τελική απόφαση παραμένει στον άνθρωπο.\n## 7. Next Actions\n1. Σύνοψη της υπόθεσης.\n2. Ενημέρωση υπευθύνων.\n3. Παρακολούθηση αποτελέσματος.`;
  };

  const handleAnalyze = async () => {
    if (!inputText.trim()) return alert("Please enter some input first.");
    setIsLoading(true);
    setActiveTab('2️⃣ AI Analysis'); 

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (useAI && apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
	const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
        const prompt = `${MAIN_PROMPT}\n\nChallenge type:\n${challengeType}\n\nUser input:\n${inputText}`;
        const result = await model.generateContent(prompt);
        setAnalysisResult(result.response.text());
        setAnalysisMode('Gemini AI Mode');
      } catch (error) {
        setAnalysisResult(`## Demo safety fallback activated\nGemini AI could not complete the analysis, so the app automatically switched to rule-based demo mode.\n\n---\n${analyzeCaseWithRules(inputText)}`);
        setAnalysisMode('Rule-based Demo Mode (Gemini fallback)');
      }
    } else {
      setAnalysisResult(`## Gemini API key missing\nNo Gemini API key was detected, so the app automatically switched to rule-based demo mode.\n\n---\n${analyzeCaseWithRules(inputText)}`);
      setAnalysisMode(useAI ? 'Rule-based Demo Mode (missing Gemini API key)' : 'Rule-based Demo Mode');
    }
    setIsLoading(false);
  };

  const downloadFile = (filename, content) => {
    const element = document.createElement("a");
    const file = new Blob([content], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const timeSavedPerCase = Math.max(manualMinutes - aiMinutes, 0);
  const totalHoursSaved = ((timeSavedPerCase * casesPerDay) / 60).toFixed(1);

  return (
    <div className="st-app">
      
      {/* ================= SIDEBAR ================= */}
      <div className="st-sidebar">
        <h2>⚙️ Demo Settings</h2>
        <span className="st-caption">Configure the prototype before running the analysis.</span>

        <label className="st-label">Project name
          <input type="text" className="st-input" value={projectName} onChange={e => setProjectName(e.target.value)} />
        </label>

        <label className="st-label">Challenge type
          <select className="st-select" value={challengeType} onChange={e => setChallengeType(e.target.value)}>
            {Object.keys(DEMO_CASES).map(key => <option key={key}>{key}</option>)}
          </select>
        </label>

        <label className="st-checkbox-label">
          <input type="checkbox" className="st-checkbox" checked={useDemo} onChange={e => setUseDemo(e.target.checked)} />
          Use demo input
        </label>

        <label className="st-checkbox-label">
          <input type="checkbox" className="st-checkbox" checked={useAI} onChange={e => setUseAI(e.target.checked)} />
          Use Gemini AI analysis
        </label>

        <hr />
        <h3>🔐 AI Mode Status</h3>
        {import.meta.env.VITE_GEMINI_API_KEY ? (
          <>
            <div className="st-success">Gemini API key detected</div>
            <span className="st-caption">The app will try Gemini first when AI mode is enabled.</span>
          </>
        ) : (
          <>
            <div className="st-warning">No Gemini API key detected</div>
            <span className="st-caption">The app can still run using rule-based demo mode.</span>
          </>
        )}

        <hr />
        <h3>🧭 Core Workflow</h3>
        <span className="st-caption">Input → AI Analysis → Recommendation → Explanation → Business Impact → Pitch</span>
        
        <hr />
        <details className="st-expander">
          <summary>ℹ️ About this prototype</summary>
          <div className="st-expander-content st-markdown">
            <p>This app is an AI decision-support prototype built for fast Makeathon experimentation.</p>
            <p>It helps transform unstructured input into structured analysis, recommended actions, business impact and pitch-ready output.</p>
            <p>If Gemini AI is unavailable, the app can continue using rule-based fallback mode, so the demo remains usable even during API, internet or rate-limit issues.</p>
          </div>
        </details>

        <span className="st-caption">Makeathon Starter v3.3</span>
      </div>

      {/* ================= MAIN CONTENT ================= */}
      <div className="st-main">
        <div className="st-block-container">
          
          <div className="app-hero">
            <h1>🤖 {projectName} Starter App</h1>
            <p>A team-ready AI decision-support prototype that turns unstructured input into structured analysis, recommendations, business impact and pitch-ready output.</p>
          </div>
          <span className="st-caption">Designed for fast Makeathon prototyping: Input → AI Analysis → Recommendation → Business Impact → Pitch</span>
          <hr />

          <div className="st-tabs">
            {['1️⃣ Input', '2️⃣ AI Analysis', '3️⃣ Business Impact', '4️⃣ Pitch Summary'].map(tab => (
              <button 
                key={tab} 
                onClick={() => setActiveTab(tab)} 
                className={`st-tab ${activeTab === tab ? 'st-tab-active' : ''}`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* TAB 1 */}
          {activeTab === '1️⃣ Input' && (
            <div>
              <h2>1. Problem Input</h2>
              <span className="st-caption">Paste a case, customer request, document summary, business problem or challenge description.</span>
              <div className="st-info">Tip: You can use the built-in demo example from the sidebar, or paste your own scenario below.</div>
              
              <label className="st-label">Input to analyze</label>
              <textarea 
                className="st-textarea" style={{height: '240px'}}
                value={inputText} onChange={(e) => setInputText(e.target.value)}
              />
              
              <div style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
                <button onClick={handleAnalyze} className="st-button st-button-primary">Analyze Case</button>
                <span className="st-caption" style={{margin: 0}}>The app will generate structured analysis, recommended actions, business impact and pitch-ready output.</span>
              </div>
            </div>
          )}

          {/* TAB 2 */}
          {activeTab === '2️⃣ AI Analysis' && (
            <div>
              <h2>2. Structured AI Analysis</h2>
              <span className="st-caption">This tab shows the structured decision-support analysis generated from the input.</span>
              
              {isLoading ? (
                <div className="st-info">Analyzing the case...</div>
              ) : !analysisResult ? (
                <div className="st-info">Go to the Input tab, enter a case and press Analyze Case.</div>
              ) : (
                <>
                  <div className={analysisMode.includes('Gemini AI Mode') ? 'st-success' : 'st-warning'}>
                    Analysis mode: {analysisMode}
                  </div>
                  <hr />
                  <div className="st-markdown">
                    <ReactMarkdown>{analysisResult}</ReactMarkdown>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 3 */}
          {activeTab === '3️⃣ Business Impact' && (
            <div>
              <h2>3. Business Impact Estimator</h2>
              <span className="st-caption">Use this section to translate the AI assistant into measurable business value.</span>
              <div className="st-info">The numbers are approximate. They are meant to support the pitch, not to act as exact financial calculations.</div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                <label className="st-label">Manual analysis time per case
                  <input type="number" className="st-input" value={manualMinutes} onChange={e => setManualMinutes(Number(e.target.value))} />
                </label>
                <label className="st-label">AI-assisted time per case
                  <input type="number" className="st-input" value={aiMinutes} onChange={e => setAiMinutes(Number(e.target.value))} />
                </label>
                <label className="st-label">Cases per day
                  <input type="number" className="st-input" value={casesPerDay} onChange={e => setCasesPerDay(Number(e.target.value))} />
                </label>
              </div>

              <hr />
              <h3>Estimated operational impact</h3>

              <div className="st-metric-container">
                <div className="st-metric">
                  <span className="st-metric-label">Time saved per case</span>
                  <span className="st-metric-value">{timeSavedPerCase} min</span>
                </div>
                <div className="st-metric">
                  <span className="st-metric-label">Cases per day</span>
                  <span className="st-metric-value">{casesPerDay}</span>
                </div>
                <div className="st-metric">
                  <span className="st-metric-label">Hours saved per day</span>
                  <span className="st-metric-value">{totalHoursSaved}</span>
                </div>
              </div>

              <div className="st-success">
                Pitch line: The tool can save approximately {totalHoursSaved} hours per day for a team handling {casesPerDay} cases daily.
              </div>
              <span className="st-caption">This impact estimate can be used during the presentation to explain why the solution is useful in practice.</span>
            </div>
          )}

          {/* TAB 4 */}
          {activeTab === '4️⃣ Pitch Summary' && (
            <div>
              <h2>4. Pitch-ready Summary</h2>
              <span className="st-caption">This tab turns the analysis into presentation-friendly material and downloadable reports.</span>
              
              <h3>Presentation summary</h3>
              <div className="st-markdown">
                <ReactMarkdown>{`### ${projectName}\n**Problem**\nTeams often receive unstructured information and lose time turning it into clear decisions.\n\n**Solution**\n${projectName} is an AI-powered decision-support tool that analyzes input, produces a recommendation, explains the reasoning and suggests next actions.\n\n**Business value**\nThe solution reduces manual analysis time, improves consistency and helps teams act faster while keeping humans in control.`}</ReactMarkdown>
              </div>

              <hr />
              <h3>Export results</h3>
              {analysisResult ? (
                <div className="st-success">Export is ready. The full report includes the analyzed input, analysis mode, AI output, business impact estimate and pitch summary.</div>
              ) : (
                <div className="st-warning">No analysis has been generated yet. Go to the Input tab, press Analyze Case, and then export the report.</div>
              )}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button disabled={!analysisResult} onClick={() => downloadFile('report.txt', analysisResult)} className="st-button">
                  Download Full Report as TXT
                </button>
                <button onClick={() => downloadFile('pitch.txt', "Pitch Summary")} className="st-button">
                  Download Pitch Summary as TXT
                </button>
              </div>
            </div>
          )}
          
          <hr />
          <span className="st-caption">UniAI Makeathon Starter App v3.2 · Input → AI Analysis → Recommendation → Explanation → Business Impact → Pitch</span>
        </div>
      </div>
    </div>
  );
}