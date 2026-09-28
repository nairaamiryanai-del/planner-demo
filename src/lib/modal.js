// Клик по фону модального окна не закрывает его (чтобы не терять введённое),
// а коротко «встряхивает» окно — показывает, что оно активно. Закрытие — только
// через крестик или кнопку «Отмена».
export function shakeOnOverlayClick(e) {
  if (e.target !== e.currentTarget) return;
  const modal = e.currentTarget.querySelector('.modal');
  if (!modal) return;
  modal.classList.remove('shake');
  void modal.offsetWidth; // перезапуск анимации
  modal.classList.add('shake');
}
