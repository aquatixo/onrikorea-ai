"use client";

// Last resort when the root layout itself fails, so it can't use the app's layout, theme,
// or dictionary -- plain bilingual text with inline styles.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  console.error(error);
  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fafafa", color: "#18181b" }}>
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ maxWidth: 420, textAlign: "center" }}>
            <title>OnriKorea</title>
            <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>문제가 생겼습니다</h1>
            <p style={{ fontSize: 14, color: "#71717a", margin: "0 0 4px" }}>
              일시적인 문제로 화면을 불러오지 못했습니다. 계속되면 관리자에게 알려주세요.
            </p>
            <p style={{ fontSize: 13, color: "#a1a1aa", margin: "0 0 20px" }}>Something went wrong. Please try again.</p>
            <button
              onClick={() => retry()}
              style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#18181b", color: "#fff", cursor: "pointer" }}
            >
              다시 시도 / Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
