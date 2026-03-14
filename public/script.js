const demoButton = document.getElementById('demo-btn');

demoButton.addEventListener('click', () => {
  const sectionTitle = document.querySelector('.section h2');

  if (sectionTitle) {
    sectionTitle.scrollIntoView({ behavior: 'smooth' });
  }

  setTimeout(() => {
    alert('Скоро здесь появится демонстрация AI-ассистента.');
  }, 500);
});
const startButton = document.getElementById('start-btn');

if (startButton) {
  startButton.addEventListener('click', () => {
    alert('Следующий этап: подключение реальных функций AI-ассистента.');
  });
}
