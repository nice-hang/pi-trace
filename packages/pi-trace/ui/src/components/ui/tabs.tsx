import { Tabs as TabsParts } from "@base-ui/react/tabs"

import { cn } from "@/lib/utils"

function TabsRoot({ className, ...props }: TabsParts.Root.Props) {
    return (
        <TabsParts.Root
            data-slot="tabs"
            className={cn("flex flex-col", className)}
            {...props}
        />
    )
}

function TabsList({ className, ...props }: TabsParts.List.Props) {
    return (
        <TabsParts.List
            data-slot="tabs-list"
            className={cn(
                "inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5 text-muted-foreground",
                className
            )}
            {...props}
        />
    )
}

function TabsTab({ className, ...props }: TabsParts.Tab.Props) {
    return (
        <TabsParts.Tab
            data-slot="tabs-tab"
            className={cn(
                "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all outline-none",
                "hover:bg-background/50 hover:text-foreground",
                "focus-visible:ring-3 focus-visible:ring-ring/50",
                "aria-selected:bg-background aria-selected:text-foreground aria-selected:shadow-xs",
                className
            )}
            {...props}
        />
    )
}

function TabsPanel({ className, ...props }: TabsParts.Panel.Props) {
    return (
        <TabsParts.Panel
            data-slot="tabs-panel"
            className={cn("mt-2 flex-1 outline-none", className)}
            {...props}
        />
    )
}

export const Tabs = TabsRoot
export { TabsList, TabsTab, TabsPanel }
