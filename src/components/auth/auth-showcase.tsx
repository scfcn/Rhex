import { DinoGame } from "@/components/auth/dino-game"
import { cn } from "@/lib/utils"
import TrueFocus from '@/components/TrueFocus';

interface AuthShowcaseProps {
  className?: string
  siteName: string
}

export function AuthShowcase({
  className,
  siteName,
}: AuthShowcaseProps) {
  if (!siteName.includes(' ')) {
    let borefix = ' 社区';
    if(siteName.includes('社区')){
borefix =' BBS'
    }
  siteName = siteName + borefix;
}
  return (
    <div className={cn("auth-showcase-layout", className)}>
      <div className="auth-showcase-wordmark-shell" aria-hidden>
<TrueFocus 
sentence={siteName}
manualMode={false}
blurAmount={5}
borderColor="#5227FF"
animationDuration={0.5}
pauseBetweenAnimations={1}
/>
      </div>

      <DinoGame />
    </div>
  )
}
