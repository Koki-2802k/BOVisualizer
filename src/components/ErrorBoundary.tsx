import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children?: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error inside ErrorBoundary:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "16px",
            background: "#fef2f2",
            color: "#b91c1c",
            borderRadius: "8px",
            border: "1px solid #fee2e2",
            gap: "8px",
            overflow: "auto",
            lineHeight: 1.4,
          }}
        >
          <h3 style={{ margin: 0, fontSize: "22px", fontWeight: 600 }}>
            {this.props.fallbackTitle ?? "エラーが発生しました"}
          </h3>
          <p style={{ margin: 0, fontSize: "22px" }}>
            {this.state.error?.message ?? "不明な描画エラーが発生しました。"}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: "8px",
              padding: "6px 12px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#ffffff",
              backgroundColor: "#dc2626",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            ページを再読み込み
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
