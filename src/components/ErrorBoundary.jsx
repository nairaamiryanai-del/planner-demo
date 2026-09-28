import { Component } from 'react';

// Ловит любые ошибки рендера: вместо белого экрана показывает сообщение
// и кнопку перезагрузки. Данные при этом не трогаются.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Ошибка рендера:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
        padding: 24, textAlign: 'center', fontFamily: 'Inter, sans-serif',
        background: '#f1efe8', color: '#36423a',
      }}>
        <span style={{ fontSize: 40 }}>😔</span>
        <h2 style={{ margin: 0 }}>Что-то пошло не так</h2>
        <p style={{ margin: 0, maxWidth: 420, color: '#5f6b5f' }}>
          Приложение споткнулось об ошибку. Данные целы: нажми кнопку, и всё загрузится заново.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 24px', borderRadius: 10, border: 'none',
            background: '#5a6b50', color: '#fff', fontSize: 15, cursor: 'pointer',
          }}
        >
          Перезагрузить
        </button>
      </div>
    );
  }
}
