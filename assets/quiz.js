/* Reusable quiz widget for lessons.
 *
 * Markup contract:
 *   <div class="quiz" data-explanation="Shown after a correct answer.">
 *     <p class="quiz-question">…</p>
 *     <div class="quiz-options">
 *       <button class="quiz-option" data-correct>Right answer</button>
 *       <button class="quiz-option">Wrong answer</button>
 *     </div>
 *     <p class="quiz-feedback" hidden></p>
 *   </div>
 *
 * Behaviour: clicking a wrong option marks it and disables it; clicking the
 * correct option marks it, disables all options, and reveals the explanation.
 * Keep every option in a question the same word count so length gives no hint.
 */
(function () {
  "use strict";

  function handleClick(event) {
    var button = event.target.closest(".quiz-option");
    if (!button || button.disabled) return;

    var quiz = button.closest(".quiz");
    var feedback = quiz.querySelector(".quiz-feedback");

    if (button.hasAttribute("data-correct")) {
      button.classList.add("is-correct");
      quiz.querySelectorAll(".quiz-option").forEach(function (option) {
        option.disabled = true;
      });
      feedback.textContent = quiz.dataset.explanation || "Correct.";
    } else {
      button.classList.add("is-wrong");
      button.disabled = true;
      feedback.textContent = "Not quite — try again.";
    }
    feedback.hidden = false;
  }

  document.addEventListener("click", handleClick);
})();
