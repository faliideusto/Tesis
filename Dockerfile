FROM maven:3.9-eclipse-temurin-17 AS build

LABEL org.opencontainers.image.title="Tesis"

WORKDIR /app

COPY pom.xml .
RUN mvn dependency:go-offline -B

COPY src ./src

RUN mvn clean package -DskipTests && mvn dependency:copy-dependencies -DincludeScope=runtime -DoutputDirectory=target/lib

FROM eclipse-temurin:17-jre

LABEL org.opencontainers.image.title="Tesis"

WORKDIR /app

COPY --from=build /app/target ./target

ENV PORT=10000

EXPOSE 10000

CMD ["java", "-cp", "target/classes:target/lib/*", "es.tesis.web.ServidorWeb"]
