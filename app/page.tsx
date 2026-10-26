
"use client";

import { useState, type FormEvent } from "react";

const API_URL = "http://127.0.0.1:8002";

type Topic = {
  name: string;
  matched_keywords: string[];
};

type Gap = {
  topic: string;
  reason: string;
};

type RoadmapItem = {
  step: number;
  topic: string;
  action: string;
};

type PracticeQuestion = {
  topic: string;
  question: string;
  type: string;
  options?: string[];
  correct_answer?: string;
  explanation?: string;
};

type EvaluationResult = {
  topic: string;
  question: string;
  score: number;
  feedback: string;
  matched_concepts: string[];
  is_gap: boolean;
  needs_review?: boolean;
  is_correct?: boolean;
  correct_answer?: string;
  explanation?: string;
};

type AnalysisReport = {
  id: number;
  student_name: string;
  filename: string;
  file_type: string;
  extracted_characters: number;
  subject: string;
  topics: Topic[];
  potential_gaps: Gap[];
  roadmap: RoadmapItem[];
  questions: PracticeQuestion[];
  summary: string;
  analysis_method: string;
  limitations: string;
};

export default function Home() {
  const [studentName, setStudentName] = useState("");
  const [subject, setSubject] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("topics");

  const [studentAnswers, setStudentAnswers] = useState<string[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationResult[]>([]);
  const [evaluating, setEvaluating] = useState(false);
  const [submittedAnswers, setSubmittedAnswers] = useState(false);
  const [evaluationGaps, setEvaluationGaps] = useState<Gap[]>([]);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setError("Please select a PDF or DOCX file.");
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase();

    if (!["pdf", "docx"].includes(extension || "")) {
      setError("Only PDF and DOCX files are supported.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be 10 MB or less.");
      return;
    }

    setLoading(true);
    setError("");
    setReport(null);
    setStudentAnswers([]);
    setEvaluations([]);
    setEvaluationGaps([]);
    setSubmittedAnswers(false);

    const formData = new FormData();
    formData.append("student_name", studentName.trim() || "Student");
    formData.append("subject", subject.trim());
    formData.append("file", file);

    try {
      const response = await fetch(`${API_URL}/analyze-file`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof result.detail === "string"
            ? result.detail
            : "Unable to analyze this file. Please try again."
        );
      }

      setReport(result);
      setActiveTab("topics");

      window.setTimeout(() => {
        document.getElementById("analysis-report")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not connect to the backend. Make sure FastAPI is running on port 8002."
      );
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setStudentName("");
    setSubject("");
    setFile(null);
    setReport(null);
    setError("");
    setActiveTab("topics");
    setStudentAnswers([]);
    setEvaluations([]);
    setEvaluationGaps([]);
    setEvaluating(false);
    setSubmittedAnswers(false);

    const fileInput = document.getElementById(
      "subject-file"
    ) as HTMLInputElement | null;

    if (fileInput) {
      fileInput.value = "";
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateAnswer(index: number, answer: string) {
    setStudentAnswers((previous) => {
      const updated = [...previous];
      updated[index] = answer;
      return updated;
    });

    setSubmittedAnswers(false);
    setEvaluations([]);
    setEvaluationGaps([]);
    setError("");
  }

  async function submitAnswers() {
    if (!report) return;

    if (
      report.questions.some(
        (_, index) => !(studentAnswers[index] || "").trim()
      )
    ) {
      setError("Please answer all practice questions before submitting.");
      return;
    }

    setError("");
    setEvaluating(true);
    setSubmittedAnswers(false);
    setEvaluations([]);
    setEvaluationGaps([]);

    const answers = report.questions.map((question, index) => ({
      topic: question.topic,
      question: question.question,
      answer: (studentAnswers[index] || "").trim(),
    }));

    const formData = new FormData();
    formData.append("analysis_id", String(report.id));
    formData.append("answers_json", JSON.stringify(answers));

    try {
      const response = await fetch(`${API_URL}/evaluate-answers`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof result.detail === "string"
            ? result.detail
            : "Unable to evaluate answers. Please try again."
        );
      }

      setEvaluations(
        Array.isArray(result.results) ? result.results : []
      );

      setEvaluationGaps(
        Array.isArray(result.potential_gaps)
          ? result.potential_gaps
          : []
      );

      setSubmittedAnswers(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not connect to the evaluation API."
      );
    } finally {
      setEvaluating(false);
    }
  }

  const tabs = [
    { id: "topics", label: "Topics" },
    { id: "gaps", label: "Potential Gaps" },
    { id: "roadmap", label: "Learning Roadmap" },
    { id: "quiz", label: "Practice Questions" },
  ];

  const correctCount = evaluations.filter(
    (evaluation) => evaluation.is_correct === true
  ).length;

  const mcqCount = evaluations.filter(
    (evaluation) => evaluation.is_correct !== undefined
  ).length;

  const scorePercentage = mcqCount
    ? Math.round((correctCount / mcqCount) * 100)
    : 0;

  const allGaps = [
    ...(report?.potential_gaps || []),
    ...evaluationGaps,
  ].filter(
    (gap, index, array) =>
      array.findIndex((item) => item.topic === gap.topic) === index
  );

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <nav className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 px-5 py-4 backdrop-blur md:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <a
            href="#"
            className="text-xl font-extrabold tracking-tight md:text-2xl"
          >
            <span className="text-cyan-400">GapFinder</span> AI
          </a>

          <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-medium text-cyan-300 sm:text-sm">
            Student Learning Assistant
          </span>
        </div>
      </nav>

      <section className="relative overflow-hidden px-5 pb-14 pt-16 md:px-10 md:pb-20 md:pt-24">
        <div className="pointer-events-none absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="relative mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-cyan-300">
            <span>✦</span> Learn smarter with your own study material
          </span>

          <h1 className="mt-7 text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
            Your Notes.
            <span className="block text-cyan-400">
              Your Learning Roadmap.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-400 md:text-lg">
            Upload your subject notes. GapFinder AI extracts topics, highlights
            possible areas to review, and prepares a personalized learning plan
            with MCQ practice questions.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-16 md:px-8">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5 shadow-2xl shadow-black/20 sm:p-8">
          <div className="mb-7">
            <p className="text-sm font-semibold uppercase tracking-widest text-cyan-400">
              Step 1
            </p>

            <h2 className="mt-2 text-2xl font-bold">
              Upload Subject Material
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Add your details and choose a PDF or Word document.
            </p>
          </div>

          <form onSubmit={handleUpload} className="space-y-6">
            <div>
              <label
                htmlFor="student-name"
                className="mb-2 block text-sm font-semibold text-slate-200"
              >
                Student Name
              </label>

              <input
                id="student-name"
                type="text"
                value={studentName}
                onChange={(event) => setStudentName(event.target.value)}
                placeholder="Enter your name"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3.5 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10"
              />
            </div>

            <div>
              <label
                htmlFor="subject"
                className="mb-2 block text-sm font-semibold text-slate-200"
              >
                Subject Name
              </label>

              <input
                id="subject"
                type="text"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Example: Machine Learning"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3.5 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10"
              />
            </div>

            <div>
              <label
                htmlFor="subject-file"
                className="mb-2 block text-sm font-semibold text-slate-200"
              >
                Subject File
              </label>

              <label
                htmlFor="subject-file"
                className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 bg-slate-950/70 px-5 py-8 text-center transition hover:border-cyan-400 hover:bg-cyan-400/5"
              >
                <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-cyan-400/10 text-3xl">
                  📄
                </div>

                <span className="break-all font-semibold text-white">
                  {file ? file.name : "Choose your subject file"}
                </span>

                <span className="mt-2 text-sm text-slate-400">
                  {file
                    ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
                    : "Click here to browse PDF or DOCX"}
                </span>

                <span className="mt-4 rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-cyan-300">
                  Browse Files
                </span>

                <input
                  id="subject-file"
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="sr-only"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] || null);
                    setError("");
                    setReport(null);
                    setStudentAnswers([]);
                    setEvaluations([]);
                    setEvaluationGaps([]);
                    setSubmittedAnswers(false);
                  }}
                />
              </label>

              <p className="mt-2 text-xs text-slate-500">
                PDF or DOCX · Maximum file size: 10 MB
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm leading-6 text-red-300"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-cyan-400 px-6 py-4 font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
                  Analyzing Your File...
                </>
              ) : (
                <>
                  Analyze My Subject File <span>→</span>
                </>
              )}
            </button>

            <p className="text-center text-xs leading-5 text-slate-500">
              Your file is processed by the local backend. Upload only study
              materials you are allowed to use.
            </p>
          </form>
        </div>
      </section>

      {report && (
        <section
          id="analysis-report"
          className="mx-auto max-w-6xl scroll-mt-24 px-5 pb-20 md:px-8"
        >
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-cyan-400">
                Step 2 · Your Results
              </p>

              <h2 className="mt-3 text-3xl font-extrabold md:text-4xl">
                Your Learning Report
              </h2>

              <p className="mt-3 max-w-2xl text-slate-400">
                {report.summary}
              </p>
            </div>

            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold hover:border-cyan-400 hover:text-cyan-300"
            >
              Upload Another File
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">Subject</p>
              <h3 className="mt-3 break-words text-lg font-bold text-cyan-300">
                {report.subject}
              </h3>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">Topics Found</p>
              <h3 className="mt-3 text-3xl font-extrabold">
                {report.topics.length}
              </h3>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">Possible Review Areas</p>
              <h3 className="mt-3 text-3xl font-extrabold text-amber-300">
                {allGaps.length}
              </h3>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm text-slate-400">Practice Questions</p>
              <h3 className="mt-3 text-3xl font-extrabold text-green-300">
                {report.questions.length}
              </h3>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-slate-400">Uploaded document</p>

                <h3 className="mt-2 break-all font-semibold">
                  {report.filename}
                </h3>

                <p className="mt-2 text-xs text-slate-500">
                  {report.file_type} ·{" "}
                  {report.extracted_characters.toLocaleString()} characters
                  extracted · Report ID #{report.id}
                </p>
              </div>

              <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs font-semibold text-green-300">
                Analysis complete
              </span>
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
            <div className="flex gap-1 overflow-x-auto border-b border-slate-800 p-2">
              {tabs.map((tab) => (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`shrink-0 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    activeTab === tab.id
                      ? "bg-cyan-400 text-slate-950"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-5 sm:p-7">
              {activeTab === "topics" && (
                <div>
                  <h3 className="text-xl font-bold">Topics Detected</h3>

                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    These topics were identified from keywords and headings
                    in your uploaded material.
                  </p>

                  {report.topics.length ? (
                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                      {report.topics.map((topic, index) => (
                        <div
                          key={`${topic.name}-${index}`}
                          className="rounded-xl border border-slate-800 bg-slate-950 p-5"
                        >
                          <div className="flex items-start gap-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-cyan-400/10 text-sm font-bold text-cyan-300">
                              {index + 1}
                            </span>

                            <div className="min-w-0">
                              <h4 className="font-semibold">{topic.name}</h4>

                              {topic.matched_keywords.length > 0 ? (
                                <p className="mt-2 text-sm leading-6 text-slate-400">
                                  Matched: {topic.matched_keywords.join(", ")}
                                </p>
                              ) : (
                                <p className="mt-2 text-sm text-slate-500">
                                  Detected as a possible document heading.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-5 text-amber-300">
                      No recognizable topics were found. Check whether the
                      file contains readable text.
                    </p>
                  )}
                </div>
              )}

              {activeTab === "gaps" && (
                <div>
                  <h3 className="text-xl font-bold">
                    Potential Knowledge Gaps
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    These are areas to review, not confirmed weaknesses. A
                    missing keyword does not necessarily mean you do not
                    understand a topic.
                  </p>

                  {allGaps.length > 0 ? (
                    <div className="mt-6 space-y-4">
                      {allGaps.map((gap, index) => (
                        <div
                          key={`${gap.topic}-${index}`}
                          className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5"
                        >
                          <h4 className="font-semibold text-amber-200">
                            {gap.topic}
                          </h4>

                          <p className="mt-2 text-sm leading-6 text-slate-400">
                            {gap.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-6 rounded-xl border border-green-500/20 bg-green-500/5 p-5">
                      <h4 className="font-semibold text-green-200">
                        No specific gaps detected
                      </h4>

                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        Try the practice questions to check which concepts may
                        need revision.
                      </p>

                      <button
                        type="button"
                        onClick={() => setActiveTab("quiz")}
                        className="mt-4 rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-300"
                      >
                        Try Practice Questions
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "roadmap" && (
                <div>
                  <h3 className="text-xl font-bold">
                    Your Learning Roadmap
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Follow these steps to revise the topics found in your file.
                  </p>

                  {report.roadmap.length ? (
                    <div className="mt-6 space-y-4">
                      {report.roadmap.map((item) => (
                        <div
                          key={item.step}
                          className="flex gap-4 rounded-xl border border-slate-800 bg-slate-950 p-5"
                        >
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cyan-400/10 font-bold text-cyan-300">
                            {item.step}
                          </div>

                          <div>
                            <h4 className="font-semibold">{item.topic}</h4>
                            <p className="mt-2 text-sm leading-6 text-slate-400">
                              {item.action}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-5 text-slate-400">
                      No roadmap items could be generated from this document.
                    </p>
                  )}
                </div>
              )}

              {activeTab === "quiz" && (
                <div>
                  <h3 className="text-xl font-bold">Practice Questions</h3>

                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Select one option for each question. Submit your answers
                    to see your score, correct answers and explanations.
                  </p>

                  {report.questions.length > 0 ? (
                    <div className="mt-6 space-y-5">
                      {report.questions.map((question, index) => {
                        const evaluation = evaluations.find(
                          (item) =>
                            item.topic === question.topic &&
                            item.question === question.question
                        );

                        const selectedAnswer = studentAnswers[index] || "";

                        return (
                          <div
                            key={`${question.topic}-${index}`}
                            className="rounded-xl border border-slate-800 bg-slate-950 p-5"
                          >
                            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                              Question {index + 1} · {question.topic}
                            </p>

                            <p className="mt-3 font-medium leading-7">
                              {question.question}
                            </p>

                            {question.options &&
                            question.options.length > 0 ? (
                              <div className="mt-4 space-y-3">
                                {question.options.map((option, optionIndex) => {
                                  const isSelected =
                                    selectedAnswer === option;

                                  const isCorrectOption =
                                    submittedAnswers &&
                                    evaluation?.correct_answer === option;

                                  const isWrongSelectedOption =
                                    submittedAnswers &&
                                    isSelected &&
                                    evaluation?.is_correct === false;

                                  let optionStyle =
                                    "border-slate-700 bg-slate-900 hover:border-slate-500";

                                  if (isSelected && !submittedAnswers) {
                                    optionStyle =
                                      "border-cyan-400 bg-cyan-400/10";
                                  }

                                  if (isCorrectOption) {
                                    optionStyle =
                                      "border-green-500 bg-green-500/10";
                                  } else if (isWrongSelectedOption) {
                                    optionStyle =
                                      "border-red-500 bg-red-500/10";
                                  }

                                  return (
                                    <label
                                      key={`${index}-${optionIndex}`}
                                      className={`flex items-start gap-3 rounded-xl border p-4 transition ${
                                        submittedAnswers
                                          ? "cursor-default"
                                          : "cursor-pointer"
                                      } ${optionStyle}`}
                                    >
                                      <input
                                        type="radio"
                                        name={`question-${index}`}
                                        value={option}
                                        checked={isSelected}
                                        disabled={submittedAnswers || evaluating}
                                        onChange={() =>
                                          updateAnswer(index, option)
                                        }
                                        className="mt-1 accent-cyan-400"
                                      />

                                      <span className="min-w-0 flex-1 text-sm leading-6 text-slate-200">
                                        <strong className="mr-2 text-cyan-300">
                                          {String.fromCharCode(
                                            65 + optionIndex
                                          )}
                                          .
                                        </strong>

                                        {option}

                                        {isCorrectOption && (
                                          <span className="ml-2 font-semibold text-green-300">
                                            ✓ Correct answer
                                          </span>
                                        )}

                                        {isWrongSelectedOption && (
                                          <span className="ml-2 font-semibold text-red-300">
                                            ✗ Your answer
                                          </span>
                                        )}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            ) : (
                              <textarea
                                value={selectedAnswer}
                                onChange={(event) =>
                                  updateAnswer(index, event.target.value)
                                }
                                disabled={submittedAnswers || evaluating}
                                placeholder="Type your answer here..."
                                rows={4}
                                aria-label={`Answer for question ${index + 1}`}
                                className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10 disabled:opacity-70"
                              />
                            )}

                            {submittedAnswers && evaluation && (
                              <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <h4 className="font-semibold text-cyan-200">
                                    Answer Feedback
                                  </h4>

                                  <span
                                    className={`rounded-full px-3 py-1 text-sm font-bold ${
                                      evaluation.is_correct === true
                                        ? "bg-green-400/10 text-green-300"
                                        : evaluation.is_correct === false
                                          ? "bg-red-400/10 text-red-300"
                                          : "bg-amber-400/10 text-amber-300"
                                    }`}
                                  >
                                    {evaluation.is_correct === true
                                      ? "Correct · 100%"
                                      : evaluation.is_correct === false
                                        ? "Incorrect · 0%"
                                        : `Score: ${evaluation.score}%`}
                                  </span>
                                </div>

                                <p className="mt-3 text-sm leading-6 text-slate-300">
                                  {evaluation.feedback}
                                </p>

                                {evaluation.correct_answer && (
                                  <div className="mt-3 rounded-lg border border-green-500/20 bg-green-500/5 p-3">
                                    <p className="text-sm font-semibold text-green-300">
                                      Correct answer:
                                    </p>

                                    <p className="mt-1 text-sm leading-6 text-slate-200">
                                      {evaluation.correct_answer}
                                    </p>
                                  </div>
                                )}

                                {evaluation.explanation && (
                                  <div className="mt-3">
                                    <p className="text-sm font-semibold text-cyan-300">
                                      Explanation
                                    </p>

                                    <p className="mt-1 text-sm leading-6 text-slate-400">
                                      {evaluation.explanation}
                                    </p>
                                  </div>
                                )}

                                {evaluation.matched_concepts?.length > 0 &&
                                  !evaluation.correct_answer && (
                                    <p className="mt-3 text-sm leading-6 text-slate-400">
                                      Matched concepts:{" "}
                                      {evaluation.matched_concepts.join(", ")}
                                    </p>
                                  )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {error && (
                        <div
                          role="alert"
                          className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
                        >
                          {error}
                        </div>
                      )}

                      {!submittedAnswers && (
                        <button
                          type="button"
                          onClick={submitAnswers}
                          disabled={evaluating}
                          className="w-full rounded-xl bg-cyan-400 px-5 py-4 font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {evaluating
                            ? "Checking Your Answers..."
                            : "Submit Answers"}
                        </button>
                      )}

                      {submittedAnswers && (
                        <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-5">
                          <h4 className="font-semibold text-cyan-200">
                            Your Quiz Results
                          </h4>

                          {mcqCount > 0 ? (
                            <>
                              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                                <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                                  <p className="text-sm text-slate-400">
                                    Total Score
                                  </p>
                                  <p className="mt-2 text-3xl font-extrabold text-cyan-300">
                                    {scorePercentage}%
                                  </p>
                                </div>

                                <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                                  <p className="text-sm text-slate-400">
                                    Correct
                                  </p>
                                  <p className="mt-2 text-3xl font-extrabold text-green-300">
                                    {correctCount}
                                  </p>
                                </div>

                                <div className="col-span-2 rounded-xl border border-slate-700 bg-slate-950 p-4 sm:col-span-1">
                                  <p className="text-sm text-slate-400">
                                    Total MCQs
                                  </p>
                                  <p className="mt-2 text-3xl font-extrabold">
                                    {mcqCount}
                                  </p>
                                </div>
                              </div>

                              <p className="mt-4 text-sm leading-6 text-slate-300">
                                You answered {correctCount} out of {mcqCount}{" "}
                                multiple-choice questions correctly.
                              </p>
                            </>
                          ) : (
                            <p className="mt-3 text-sm leading-6 text-slate-300">
                              Your short answers have been evaluated using
                              preliminary keyword-based feedback.
                            </p>
                          )}

                          <div className="mt-4 flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={() => setActiveTab("gaps")}
                              className="rounded-lg border border-cyan-400/40 px-4 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-400/10"
                            >
                              Review Potential Gaps
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setStudentAnswers([]);
                                setEvaluations([]);
                                setEvaluationGaps([]);
                                setSubmittedAnswers(false);
                                setError("");
                              }}
                              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:border-cyan-400 hover:text-cyan-300"
                            >
                              Try Again
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="mt-5 text-amber-300">
                      No practice questions are available for this report. Try
                      uploading a document with readable subject content.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
            <h3 className="font-semibold text-blue-200">
              About this analysis
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              {report.analysis_method}. {report.limitations}
            </p>
          </div>
        </section>
      )}

      <footer className="border-t border-slate-800 px-5 py-8 text-center">
        <p className="font-semibold">
          <span className="text-cyan-400">GapFinder</span> AI
        </p>

        <p className="mt-2 text-sm text-slate-500">
          Helping students understand what to learn next.
        </p>
      </footer>
    </main>
  );
}
