<#--
  JHipster Monolith JDL Template
  Generates JHipster JDL for a monolithic application

  All bounded contexts are combined into a single application.
  Aggregates become entities organized by modules.
-->
<#-- Generate application definition -->
application {
  config {
    baseName ${model.name?replace(" ", "")?uncap_first}App
    applicationType monolith
    packageName com.example.${model.name?replace(" ", "")?lower_case}
    authenticationType jwt
    prodDatabaseType postgresql
    buildTool gradle
    clientFramework angular
    serverPort 8080
  }
  entities *
}

<#-- Generate entities grouped by bounded context -->
<#list boundedContexts as bc>
// ==========================================
// ${bc.name}
// ==========================================
<#if bc.domainVisionStatement??>
// ${bc.domainVisionStatement}
</#if>

<#list bc.aggregates as agg>
<#list agg.entities as entity>
/**
 * ${entity.name} entity
<#if entity.documentation??> * ${entity.documentation}</#if>
<#if entity.aggregateRoot?? && entity.aggregateRoot> * Aggregate root of ${agg.name}</#if>
 */
entity ${entity.name} {
<#list entity.attributes as attr>
<#if attr.name != "id" && !attr.name?ends_with("Id")>
  ${attr.name} ${mapJHipsterType(attr.type)}<#if attr.nullable?? && !attr.nullable> required</#if>
</#if>
</#list>
}

</#list>
<#-- Generate value objects with more than 2 attributes as entities -->
<#list agg.valueObjects as vo>
<#if vo.attributes?size gt 2>
/**
 * ${vo.name} value object (embedded)
<#if vo.documentation??> * ${vo.documentation}</#if>
 */
@readOnly
entity ${vo.name} {
<#list vo.attributes as attr>
  ${attr.name} ${mapJHipsterType(attr.type)}
</#list>
}

</#if>
</#list>
</#list>
</#list>

<#-- Generate relationships -->
<#list boundedContexts as bc>
<#list bc.aggregates as agg>
<#if agg.aggregateRoot?? && agg.entities?size gt 1>
// Relationships in ${agg.name} aggregate
relationship OneToMany {
<#list agg.entities as entity>
<#if !entity.aggregateRoot?? || !entity.aggregateRoot>
  ${agg.aggregateRoot.name}{${entity.name?uncap_first}s} to ${entity.name}{${agg.aggregateRoot.name?uncap_first}}
</#if>
</#list>
}

</#if>
<#-- Value object relationships -->
<#if agg.aggregateRoot??>
<#assign voCount = 0>
<#list agg.valueObjects as vo>
<#if vo.attributes?size gt 2>
<#assign voCount = voCount + 1>
</#if>
</#list>
<#if voCount gt 0>
relationship OneToOne {
<#list agg.valueObjects as vo>
<#if vo.attributes?size gt 2>
  ${agg.aggregateRoot.name}{${vo.name?uncap_first}} to ${vo.name}
</#if>
</#list>
}

</#if>
</#if>
</#list>
</#list>

<#-- Generate enums -->
<#list boundedContexts as bc>
<#list bc.aggregates as agg>
<#-- Check for status-like attributes that could be enums -->
<#list agg.entities as entity>
<#list entity.attributes as attr>
<#if attr.name?lower_case?contains("status") || attr.name?lower_case?contains("state") || attr.name?lower_case?contains("type")>
// Consider creating enum for ${entity.name}.${attr.name}
// enum ${entity.name}${attr.name?cap_first} {
//   VALUE1, VALUE2, VALUE3
// }
</#if>
</#list>
</#list>
</#list>
</#list>

<#-- DTO configuration -->
dto * with mapstruct

<#-- Service configuration -->
service * with serviceClass

<#-- Pagination -->
paginate * with pagination

<#-- Search configuration (optional) -->
// search * with elasticsearch

<#-- Helper function to map CML types to JHipster types -->
<#function mapJHipsterType cmlType>
  <#if cmlType?starts_with("-")>
    <#return "String">
  <#elseif cmlType == "String">
    <#return "String">
  <#elseif cmlType == "int" || cmlType == "Integer">
    <#return "Integer">
  <#elseif cmlType == "long" || cmlType == "Long">
    <#return "Long">
  <#elseif cmlType == "float" || cmlType == "Float">
    <#return "Float">
  <#elseif cmlType == "double" || cmlType == "Double">
    <#return "Double">
  <#elseif cmlType == "boolean" || cmlType == "Boolean">
    <#return "Boolean">
  <#elseif cmlType == "DateTime" || cmlType == "Date">
    <#return "Instant">
  <#elseif cmlType == "BigDecimal">
    <#return "BigDecimal">
  <#elseif cmlType == "UUID">
    <#return "UUID">
  <#elseif cmlType?starts_with("List<") || cmlType?starts_with("Set<")>
    <#return "String">
  <#else>
    <#return "String">
  </#if>
</#function>
