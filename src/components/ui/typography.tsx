import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

function TypographyH1({ className, ...props }: ComponentProps<"h1">) {
  return (
    <h1
      data-slot="typography-h1"
      className={cn(
        "scroll-m-20 font-heading text-4xl font-extrabold tracking-tight lg:text-5xl",
        className
      )}
      {...props}
    />
  )
}

function TypographyH2({ className, ...props }: ComponentProps<"h2">) {
  return (
    <h2
      data-slot="typography-h2"
      className={cn(
        "scroll-m-20 border-b pb-2 font-heading text-3xl font-semibold tracking-tight first:mt-0",
        className
      )}
      {...props}
    />
  )
}

function TypographyH3({ className, ...props }: ComponentProps<"h3">) {
  return (
    <h3
      data-slot="typography-h3"
      className={cn(
        "scroll-m-20 font-heading text-2xl font-semibold tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function TypographyH4({ className, ...props }: ComponentProps<"h4">) {
  return (
    <h4
      data-slot="typography-h4"
      className={cn(
        "scroll-m-20 font-heading text-xl font-semibold tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function TypographyLead({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      data-slot="typography-lead"
      className={cn("text-xl text-muted-foreground", className)}
      {...props}
    />
  )
}

function TypographySmall({ className, ...props }: ComponentProps<"small">) {
  return (
    <small
      data-slot="typography-small"
      className={cn("text-sm leading-none font-medium", className)}
      {...props}
    />
  )
}

function TypographyMuted({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      data-slot="typography-muted"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  TypographyH1,
  TypographyH2,
  TypographyH3,
  TypographyH4,
  TypographyLead,
  TypographyMuted,
  TypographySmall,
}
