"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    ChartLegend,
    ChartLegendContent,
    type ChartConfig,
} from "@/components/ui/chart";

interface SummaryChartProps {
    data: {
        name: string;
        total: number;
        color: string;
    }[];
}

export function SummaryChart({ data }: SummaryChartProps) {
    // Create chart config from data
    const chartConfig = data.reduce((config, item) => {
        config[item.name.toLowerCase()] = {
            label: item.name,
            color: item.color,
        };
        return config;
    }, {} as ChartConfig);

    // Transform data for chart
    const chartData = data.map((item) => ({
        name: item.name,
        [item.name.toLowerCase()]: item.total,
    }));

    return (
        <Card>
            <CardHeader>
                <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent>
                <ChartContainer
                    config={chartConfig}
                    className="min-h-[350px] w-full"
                >
                    <BarChart
                        accessibilityLayer
                        data={chartData}
                        barGap={8}
                        barCategoryGap={40}
                    >
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="name"
                            tickLine={false}
                            tickMargin={10}
                            axisLine={false}
                        />
                        <YAxis
                            tickLine={false}
                            tickMargin={10}
                            axisLine={false}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        {data.map((item) => (
                            <Bar
                                key={item.name}
                                dataKey={item.name.toLowerCase()}
                                fill={`var(--color-${item.name.toLowerCase()})`}
                                radius={[8, 8, 0, 0]}
                                barSize={100}
                            />
                        ))}
                    </BarChart>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}
