/**
 * Runs while the page is still being parsed, before the first paint. It switches on the
 * "motion" class that lets CSS hide elements waiting for their entrance animation, and
 * only does so when scripting works and the visitor has not asked for reduced motion.
 * If the animation code has not announced itself after a few seconds the class is
 * removed again, so content can never stay hidden.
 */
const code = `(function(){try{var d=document.documentElement;if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;d.classList.add("motion");setTimeout(function(){if(!window.__rspMotion)d.classList.remove("motion")},4000)}catch(e){}})()`;

export function MotionScript() {
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
