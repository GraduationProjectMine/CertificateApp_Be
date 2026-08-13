pipeline {
    agent any

    environment {
        REGISTRY   = "docker.io"                              // Docker Hub registry mặc định
        IMAGE_NAME = "nguyentt07/certificate-app-backend"      // đổi username nếu cần
        TAG        = "dev-${env.BUILD_NUMBER}"                 // Tag image theo số build
    }

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Check Environment') {
            steps {
                sh '''
                    node -v
                    npm -v
                    git --version
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                sh '''
                    if [ -f package-lock.json ]; then
                        npm ci
                    else
                        npm install
                    fi
                '''
            }
        }

        stage('Prisma Generate') {
            steps {
                withEnv(["DATABASE_URL=mysql://dummy:dummy@localhost:3306/dummy"]) {
                    sh '''
                        if [ -f prisma/schema.prisma ]; then
                            npx prisma generate
                        else
                            echo "No Prisma schema found, skipping."
                        fi
                    '''
                }
            }
        }

        stage('Lint') {
            steps {
                sh 'npm run lint --if-present || true'
            }
        }

        stage('Test') {
            steps {
                sh 'npm run test --if-present'
            }
        }

        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }

        stage('Build & Push Image to Registry') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-credentials',
                    usernameVariable: 'REG_USER',
                    passwordVariable: 'REG_PASS'
                )]) {
                    sh '''
                    echo "$REG_PASS" | docker login "$REGISTRY" -u "$REG_USER" --password-stdin
                    docker build -t "$IMAGE_NAME:$TAG" .
                    docker push "$IMAGE_NAME:$TAG"
                    '''
                }
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                // Credential 'cert-dev-kubeconfig' là file kubeconfig của cluster dev,
                // tạo trong Jenkins Credentials dạng "Secret file" (xem hướng dẫn bên dưới)
                withCredentials([file(credentialsId: 'cert-dev-kubeconfig', variable: 'KUBECONFIG_FILE')]) {
                    sh '''
                    export KUBECONFIG="$KUBECONFIG_FILE"
                    kubectl set image deployment/backend-deployment \
                        backend="$IMAGE_NAME:$TAG" -n blockchain-dev
                    kubectl rollout status deployment/backend-deployment \
                        -n blockchain-dev --timeout=240s
                    '''
                }
            }
        }
    }

    post {
        success {
            echo "✅ Backend CI/CD succeeded: ${IMAGE_NAME}:${TAG} deployed to blockchain-dev"
        }

        failure {
            echo 'Backend CI/CD failed. Please check the Console Output.'
        }

        always {
            deleteDir()
        }
    }
}