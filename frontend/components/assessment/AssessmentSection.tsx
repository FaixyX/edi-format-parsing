"use client";

import { useState } from "react";
import { AssessmentTable } from "./AssessmentTable";
import { useAssessments } from "@/hooks/features/assessment/useAssessments";
import { usePublicAssessments } from "@/hooks/features/assessment/usePublicAssessments";
import { AssessmentType } from "@/types/assessment";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface AssessmentSectionProps<T extends AssessmentType = AssessmentType> {
    episodeId: string | undefined;
    selectedAssessmentId: string | null;
    onSelectAssessment: (assessmentId: string | null) => void;
    selectedNewAssessment: {
        status_description: T;
        assessment_date: string;
    } | null;
    usePublicApi?: boolean; // New prop to determine which API to use
}

export function AssessmentSection<T extends AssessmentType = AssessmentType>({
    episodeId,
    selectedAssessmentId,
    onSelectAssessment,
    selectedNewAssessment,
    usePublicApi = false, // Default to authenticated API
}: AssessmentSectionProps<T>) {
    console.log(
        `[AssessmentSection] Component rendered with episodeId: ${episodeId}`
    );
    console.log(
        `[AssessmentSection] Selected assessment ID: ${selectedAssessmentId}`
    );
    console.log(
        `[AssessmentSection] Selected new assessment:`,
        selectedNewAssessment
    );

    // Use public or authenticated API based on the prop - only call the appropriate hook
    const publicHookResult = usePublicAssessments(episodeId, usePublicApi);
    const authHookResult = useAssessments(episodeId, !usePublicApi);

    // Use the appropriate data based on the API type
    const assessments = usePublicApi
        ? publicHookResult.assessments
        : authHookResult.assessments;
    const isLoading = usePublicApi
        ? publicHookResult.isLoading
        : authHookResult.isLoading;
    const error = usePublicApi ? publicHookResult.error : authHookResult.error;
    const refetch = usePublicApi
        ? publicHookResult.refetch
        : authHookResult.refetch;
    const [activeTab, setActiveTab] = useState("existing");
    // COMMENTED OUT FOR FUTURE USE - New Assessment Creation
    // const [newAssessmentType, setNewAssessmentType] = useState<AssessmentType>(
    //     "SOC (further visits)"
    // );
    // const [newAssessmentDate, setNewAssessmentDate] = useState("");
    // const [parsedDate, setParsedDate] = useState<Date | undefined>(undefined);

    console.log(`[AssessmentSection] useAssessments hook returned:`, {
        assessmentsLength: assessments.length,
        isLoading,
        hasError: !!error,
    });

    // Handle tab change
    const handleTabChange = (value: string) => {
        console.log(`[AssessmentSection] Tab changed to: ${value}`);
        setActiveTab(value);
        // COMMENTED OUT FOR FUTURE USE - New Assessment Creation
        // if (value === "new") {
        //     // Clear existing selection and set new assessment
        //     onSelectAssessment(null);
        //     onSelectNewAssessment({
        //         status_description: newAssessmentType,
        //         assessment_date: newAssessmentDate,
        //     });
        // } else {
        //     // Clear new assessment selection
        //     onSelectNewAssessment(null);
        // }
    };

    // COMMENTED OUT FOR FUTURE USE - New Assessment Creation
    // // Handle new assessment type change
    // const handleNewAssessmentTypeChange = (value: string) => {
    //     const type = value as AssessmentType;
    //     setNewAssessmentType(type);
    //     if (activeTab === "new") {
    //         onSelectNewAssessment({
    //             status_description: type,
    //             assessment_date: newAssessmentDate,
    //         });
    //     }
    // };

    // // Handle new assessment date change
    // const handleNewAssessmentDateChange = (value: string) => {
    //     setNewAssessmentDate(value);
    // };

    // // Handle parsed date change from date picker
    // const handleParsedDateChange = (date: Date | undefined) => {
    //     setParsedDate(date);
    //     if (activeTab === "new") {
    //         const actualDate = date ? date.toISOString().split("T")[0] : "";
    //         onSelectNewAssessment({
    //             status_description: newAssessmentType,
    //             assessment_date: actualDate,
    //         });
    //     }
    // };

    // Handle existing assessment selection
    const handleAssessmentSelection = (assessmentId: string | null) => {
        // COMMENTED OUT FOR FUTURE USE - New Assessment Creation
        // if (assessmentId && activeTab === "new") {
        //     // If creating new and selecting existing, switch to existing tab
        //     setActiveTab("existing");
        //     onSelectNewAssessment(null);
        // }
        onSelectAssessment(assessmentId);
    };

    const selectedAssessment = assessments.find(
        (assessment) => assessment.id === selectedAssessmentId
    );

    return (
        <div className="space-y-6">
            <Tabs
                value={activeTab}
                onValueChange={handleTabChange}
                className="w-full"
            >
                {/* COMMENTED OUT FOR FUTURE USE - New Assessment Creation */}
                {/* <TabsList className="grid w-full grid-cols-1 mb-4">
                    <TabsTrigger value="existing">
                        Select Existing Assessment
                    </TabsTrigger>
                    <TabsTrigger value="new">Create New Assessment</TabsTrigger>
                </TabsList> */}

                <TabsContent value="existing">
                    <Card>
                        <CardContent className="pt-6">
                            <AssessmentTable
                                assessments={assessments}
                                isLoading={isLoading}
                                error={error}
                                onRetry={refetch}
                                selectedAssessmentId={selectedAssessmentId}
                                onSelectAssessment={handleAssessmentSelection}
                                // disabled={activeTab === "new"} // COMMENTED OUT FOR FUTURE USE - New Assessment Creation
                                disabled={false} // Always enabled since new assessment is disabled
                                onRefresh={refetch}
                            />
                            {selectedAssessment && (
                                <>
                                    <Separator className="my-4" />
                                    <div className="bg-muted p-4 rounded-md">
                                        <h4 className="font-medium mb-2">
                                            Selected Assessment
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-sm text-muted-foreground">
                                                    Type
                                                </p>
                                                <Badge
                                                    variant="outline"
                                                    className="capitalize"
                                                >
                                                    {
                                                        selectedAssessment.status_description
                                                    }
                                                </Badge>
                                            </div>
                                            <div>
                                                <p className="text-sm text-muted-foreground">
                                                    Date
                                                </p>
                                                <p className="font-medium">
                                                    {selectedAssessment.status}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-muted-foreground">
                                                    Effective Dates
                                                </p>
                                                <p className="font-medium">
                                                    {
                                                        selectedAssessment.effective_dates
                                                    }
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-muted-foreground">
                                                    OASIS
                                                </p>
                                                <p className="font-medium">
                                                    {selectedAssessment.oasis}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* COMMENTED OUT FOR FUTURE USE - New Assessment Creation */}
                {/* <TabsContent value="new">
                    <Card>
                        <CardContent className="space-y-4 pt-6">
                            <SelectField
                                label="Assessment Type"
                                id="assessment-type"
                                options={assessmentTypeOptions}
                                value={newAssessmentType}
                                onChange={handleNewAssessmentTypeChange}
                                labelPosition="top"
                            />
                            <NaturalLanguageDatePicker
                                value={newAssessmentDate}
                                onChange={handleNewAssessmentDateChange}
                                onDateChange={handleParsedDateChange}
                                label="Assessment Date"
                                placeholder="Enter date (e.g., tomorrow, next week, 12/25/2024)"
                            />
                            {selectedNewAssessment && (
                                <div className="bg-muted p-4 rounded-md">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm text-muted-foreground">
                                                Type
                                            </p>
                                            <Badge
                                                variant="outline"
                                                className="capitalize"
                                            >
                                                {
                                                    selectedNewAssessment.status_description
                                                }
                                            </Badge>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">
                                                Date
                                            </p>
                                            <p className="font-medium">
                                                {parsedDate
                                                    ? parsedDate.toLocaleDateString()
                                                    : "Not set"}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent> */}
            </Tabs>
        </div>
    );
}
